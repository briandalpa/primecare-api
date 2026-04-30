import { prisma } from '@/application/database'
import { ResponseError } from '@/error/response-error'
import { OrderStatus, StationStatus, StationType } from '@/generated/prisma/client'
import { WorkerNotificationService } from '@/features/worker-notifications/worker-notification-service'
import { findNextStationWorker } from '@/features/worker-orders/worker-order-helper'
import { haversineDistance } from '@/utils/haversine'
import { v4 as uuid } from 'uuid'
import { CreateAdminOrderInput, GetAdminOrdersQuery, LaundryItemResponse } from './admin-order-model'
import {
  buildOrdersWhere,
  calculateOrderTotal,
  createManualOrderItems,
  getOrderSort,
} from './admin-order-helper'

const FREE_DELIVERY_KM = 2.0
const DELIVERY_RATE_PER_KM = 2000

const calculateDeliveryFee = (distanceKm: number) => {
  if (distanceKm <= FREE_DELIVERY_KM) return 0
  return Math.ceil(distanceKm - FREE_DELIVERY_KM) * DELIVERY_RATE_PER_KM
}

const computeOrderPricing = (data: CreateAdminOrderInput, distanceKm: number) => {
  // The final bill combines kilo-based laundry pricing, manual item pricing, and delivery fee.
  const laundryPrice = data.totalWeightKg * data.pricePerKg
  const deliveryFee = calculateDeliveryFee(distanceKm)
  return { deliveryFee, totalPrice: laundryPrice + deliveryFee + calculateOrderTotal(data) }
}

export class AdminOrderService {
  static async getAdminOrders(staff: any, query: GetAdminOrdersQuery) {
    const skip = (query.page - 1) * query.limit
    const where = buildOrdersWhere(staff, query)
    const { sortBy, sortOrder } = getOrderSort(query)

    const orders = await prisma.order.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { [sortBy]: sortOrder },
      include: { outlet: true, pickupRequest: true },
    })
    const total = await prisma.order.count({ where })

    return {
      data: orders,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    }
  }

  static async getAdminOrderDetail(staff: any, orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        pickupRequest: {
          include: { customerUser: { select: { id: true, name: true, email: true, phone: true } } },
        },
        outlet: true,
        items: { include: { laundryItem: true } },
        stationRecords: {
          include: {
            staff: { include: { user: { select: { id: true, name: true, email: true } } } },
            stationItems: { include: { laundryItem: true } },
            bypassRequests: true,
          },
        },
      },
    })

    if (!order) throw new ResponseError(404, 'Order not found')
    if (staff.role === 'OUTLET_ADMIN' && staff.outletId !== order.outletId) {
      throw new ResponseError(403, 'Forbidden')
    }
    return order
  }

  static async getAdminPickupRequests(staff: any, page: number, limit: number) {
    const skip = (page - 1) * limit
    const where: any = { status: 'PICKED_UP', order: null }
    if (staff.role === 'OUTLET_ADMIN') where.outletId = staff.outletId

    const pickups = await prisma.pickupRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        customerUser: { select: { id: true, name: true, email: true, phone: true } },
        outlet: true,
        address: true,
      },
    })
    const total = await prisma.pickupRequest.count({ where })

    return { data: pickups, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }
  }

  static async createAdminOrder(staff: any, data: CreateAdminOrderInput) {
    // Outlet admins can only turn a picked-up request into an order once, and only for their own outlet.
    const pickupRequest = await prisma.pickupRequest.findUnique({
      where: { id: data.pickupRequestId },
      include: { order: true, address: true, outlet: true },
    })

    if (!pickupRequest) throw new ResponseError(404, 'Pickup request not found')
    if (pickupRequest.status !== 'PICKED_UP') {
      throw new ResponseError(409, 'Pickup has not been collected yet')
    }
    if (pickupRequest.order) throw new ResponseError(409, 'Order already exists for this pickup request')
    if (staff.role === 'OUTLET_ADMIN' && pickupRequest.outletId !== staff.outletId) {
      throw new ResponseError(403, 'Forbidden')
    }

    const distanceKm = haversineDistance(
      pickupRequest.outlet.latitude,
      pickupRequest.outlet.longitude,
      pickupRequest.address.latitude,
      pickupRequest.address.longitude,
    )
    const { deliveryFee, totalPrice } = computeOrderPricing(data, distanceKm)
    const orderId = uuid()
    // Order processing always starts in the washing station with the worker who is currently on an active shift.
    const washingWorker = await findNextStationWorker(pickupRequest.outletId, StationType.WASHING)

    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          id: orderId,
          pickupRequestId: pickupRequest.id,
          outletId: pickupRequest.outletId,
          staffId: staff.id,
          pricePerKg: data.pricePerKg,
          totalWeightKg: data.totalWeightKg,
          totalPrice,
          deliveryDistanceKm: distanceKm,
          deliveryFee,
          status: OrderStatus.LAUNDRY_BEING_WASHED,
        },
      })

      await tx.stationRecord.create({
        data: {
          orderId,
          station: StationType.WASHING,
          staffId: washingWorker.id,
          status: StationStatus.IN_PROGRESS,
        },
      })

      await Promise.all(data.items.map((item) => tx.orderItem.create({
        data: {
          id: uuid(),
          orderId,
          laundryItemId: item.laundryItemId,
          quantity: item.quantity,
        },
      })))
      await createManualOrderItems(tx, orderId, data.manualItems ?? [])

      return createdOrder
    })

    WorkerNotificationService.publishOrderArrival({
      orderId: order.id,
      outletId: order.outletId,
      orderStatus: order.status,
    })

    return order
  }

  static async getLaundryItems(): Promise<LaundryItemResponse[]> {
    return prisma.laundryItem.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    })
  }
}
