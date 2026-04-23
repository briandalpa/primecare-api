import { prisma } from '@/application/database'
import { ResponseError } from '@/error/response-error'
import { OrderStatus, StationStatus, StationType } from '@/generated/prisma/client'
import { WorkerNotificationService } from '@/features/worker-notifications/worker-notification-service'
import { findNextStationWorker } from '@/features/worker-orders/worker-order-helper'
import { haversineDistance } from '@/utils/haversine'
import { v4 as uuid } from 'uuid'
import { CreateAdminOrderInput, GetAdminOrdersQuery, LaundryItemResponse } from './admin-order-model'

const VALID_ORDER_SORT = ['createdAt', 'totalPrice', 'totalWeightKg'] as const;
type OrderSortField = typeof VALID_ORDER_SORT[number];

const FREE_DELIVERY_KM = 2.0;
const DELIVERY_RATE_PER_KM = 2000; // IDR per km above the free threshold

const calculateDeliveryFee = (distanceKm: number): number => {
  if (distanceKm <= FREE_DELIVERY_KM) return 0;
  return Math.ceil(distanceKm - FREE_DELIVERY_KM) * DELIVERY_RATE_PER_KM;
};

const computeOrderPricing = (totalWeightKg: number, pricePerKg: number, distanceKm: number) => {
  const laundryPrice = totalWeightKg * pricePerKg;
  const deliveryFee = calculateDeliveryFee(distanceKm);
  return { deliveryFee, totalPrice: laundryPrice + deliveryFee };
};

// Builds order filter respecting role-based access control.
// OUTLET_ADMIN can only see orders from their assigned outlet.
const buildOrdersWhere = (staff: any, query: GetAdminOrdersQuery) => {
  const where: Record<string, unknown> = {}
  // Force outlet scope for OUTLET_ADMIN regardless of query param.
  if (staff.role === 'OUTLET_ADMIN') where.outletId = staff.outletId
  // SUPER_ADMIN can filter by outlet optionally.
  else if (query.outletId) where.outletId = query.outletId
  if (query.status) where.status = query.status
  // Date range filtering: both bounds are optional and inclusive.
  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    }
  }
  return where
}

export class AdminOrderService {

  static async getAdminOrders(staff: any, query: GetAdminOrdersQuery) {

    const skip = (query.page - 1) * query.limit
    const where = buildOrdersWhere(staff, query)
    // Allowlist sortBy to prevent probing internal field names via Prisma error messages.
    const sortBy: OrderSortField = VALID_ORDER_SORT.includes(query.sortBy as OrderSortField)
      ? (query.sortBy as OrderSortField)
      : 'createdAt'
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc'

    const orders = await prisma.order.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        outlet: true,
        pickupRequest: true
      }
    })

    const total = await prisma.order.count({ where })

    return {
      data: orders,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    }
  }

  static async getAdminOrderDetail(staff: any, orderId: string) {

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        pickupRequest: {
          include: {
            // Select only non-sensitive fields; never expose password hashes or tokens.
            customerUser: { select: { id: true, name: true, email: true, phone: true } }
          }
        },
        outlet: true,
        items: {
          include: { laundryItem: true }
        },
        stationRecords: {
          include: {
            staff: { include: { user: { select: { id: true, name: true, email: true } } } },
            stationItems: { include: { laundryItem: true } },
            bypassRequests: true
          }
        }
      }
    })

    if (!order) {
      throw new ResponseError(404, 'Order not found')
    }

    if (staff.role === 'OUTLET_ADMIN' && staff.outletId !== order.outletId) {
      throw new ResponseError(403, 'Forbidden')
    }

    return order
  }

  static async getAdminPickupRequests(staff: any, page: number, limit: number) {

    const skip = (page - 1) * limit
    const where: any = {
      status: 'PICKED_UP',
      order: null
    }

    if (staff.role === 'OUTLET_ADMIN') {
      where.outletId = staff.outletId
    }

    const pickups = await prisma.pickupRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        // Select only non-sensitive fields; never expose password hashes or tokens.
        customerUser: { select: { id: true, name: true, email: true, phone: true } },
        outlet: true,
        address: true
      }
    })

    const total = await prisma.pickupRequest.count({ where })

    return {
      data: pickups,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
    }
  }

  // Creates Order record from a picked-up PickupRequest.
  // This is the critical transition: laundry arrives at outlet and processing begins.
  static async createAdminOrder(staff: any, data: CreateAdminOrderInput) {

    const pickupRequest = await prisma.pickupRequest.findUnique({
      where: { id: data.pickupRequestId },
      include: { order: true, address: true, outlet: true }
    })

    if (!pickupRequest) {
      throw new ResponseError(404, 'Pickup request not found')
    }

    // Business rule: cannot create order until driver completes pickup.
    if (pickupRequest.status !== 'PICKED_UP') {
      throw new ResponseError(409, 'Pickup has not been collected yet')
    }

    // Idempotency check: prevent duplicate order creation.
    if (pickupRequest.order) {
      throw new ResponseError(409, 'Order already exists for this pickup request')
    }

    // OUTLET_ADMIN can only create orders for their own outlet.
    if (staff.role === 'OUTLET_ADMIN' && pickupRequest.outletId !== staff.outletId) {
      throw new ResponseError(403, 'Forbidden')
    }

    const distanceKm = haversineDistance(
      pickupRequest.outlet.latitude,
      pickupRequest.outlet.longitude,
      pickupRequest.address.latitude,
      pickupRequest.address.longitude,
    )
    const { deliveryFee, totalPrice } = computeOrderPricing(data.totalWeightKg, data.pricePerKg, distanceKm)

    const orderId = uuid()
    const washingWorker = await findNextStationWorker(
      pickupRequest.outletId,
      StationType.WASHING,
    )

    // Atomic operation: create Order, initial station record, and all OrderItems in one transaction.
    // If any step fails, the entire order is rolled back.
    const [order] = await prisma.$transaction([
      prisma.order.create({
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
        }
      }),
      prisma.stationRecord.create({
        data: {
          orderId,
          station: StationType.WASHING,
          staffId: washingWorker.id,
          status: StationStatus.IN_PROGRESS,
        },
      }),
      ...data.items.map((item) =>
        prisma.orderItem.create({
          data: {
            id: uuid(),
            orderId,
            laundryItemId: item.laundryItemId,
            quantity: item.quantity
          }
        })
      )
    ])

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
    });
  }
}
