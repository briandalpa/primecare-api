import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import { DeliveryStatus, OrderStatus, PickupStatus } from '@/generated/prisma/enums';
import type { Prisma } from '@/generated/prisma/client';
import {
  DeliveryListQuery,
  DeliveryHistoryQuery,
} from '@/validations/delivery-validation';
import {
  toDeliveryListItem,
  toDeliveryAcceptResponse,
  toDeliveryCompleteResponse,
  toDeliveryHistoryItem,
  toDeliveryOrderSummary,
  PaginatedDeliveryListResponse,
  PaginatedDeliveryHistoryResponse,
} from './delivery-model';

const orderChainInclude = {
  order: {
    include: {
      pickupRequest: {
        include: {
          address: true,
          customerUser: true,
        },
      },
    },
  },
} as const;

async function checkDriverHasActiveTask(tx: Prisma.TransactionClient, staffId: string): Promise<void> {
  const activePickup = await tx.pickupRequest.findFirst({
    where: { driverId: staffId, status: PickupStatus.DRIVER_ASSIGNED },
  });
  const activeDelivery = await tx.delivery.findFirst({
    where: { driverId: staffId, status: { in: [DeliveryStatus.DRIVER_ASSIGNED, DeliveryStatus.OUT_FOR_DELIVERY] } },
  });
  if (activePickup || activeDelivery) throw new ResponseError(409, 'Driver already has an active task');
}

async function runAcceptDeliveryTx(tx: Prisma.TransactionClient, staffId: string, deliveryId: string, outletId: string) {
  await checkDriverHasActiveTask(tx, staffId);
  // Atomic update: only succeeds if status is still PENDING (prevents concurrent accepts)
  const updated = await tx.delivery
    .update({ where: { id: deliveryId, status: DeliveryStatus.PENDING }, data: { driverId: staffId, status: DeliveryStatus.DRIVER_ASSIGNED }, include: { order: true } })
    .catch(() => { throw new ResponseError(404, 'Delivery not found'); });
  if (updated.order.outletId !== outletId) throw new ResponseError(403, 'Delivery belongs to a different outlet');
  await tx.order.update({ where: { id: updated.orderId }, data: { status: OrderStatus.LAUNDRY_OUT_FOR_DELIVERY } });
  return toDeliveryAcceptResponse(updated as typeof updated & { driverId: string }, OrderStatus.LAUNDRY_OUT_FOR_DELIVERY);
}

async function runCompleteDeliveryTx(tx: Prisma.TransactionClient, staffId: string, deliveryId: string) {
  const delivery = await tx.delivery.findFirst({ where: { id: deliveryId, status: DeliveryStatus.DRIVER_ASSIGNED } });
  if (!delivery) throw new ResponseError(404, 'Delivery not found or not in assigned state');
  if (delivery.driverId !== staffId) throw new ResponseError(403, 'You are not the assigned driver for this delivery');
  const now = new Date();
  const updated = await tx.delivery.update({ where: { id: deliveryId }, data: { status: DeliveryStatus.DELIVERED, deliveredAt: now } });
  await tx.order.update({ where: { id: delivery.orderId }, data: { status: OrderStatus.LAUNDRY_DELIVERED_TO_CUSTOMER } });
  return toDeliveryCompleteResponse(updated as typeof updated & { deliveredAt: Date }, OrderStatus.LAUNDRY_DELIVERED_TO_CUSTOMER);
}

export class DeliveryService {
  static async listDeliveries(outletId: string, query: DeliveryListQuery): Promise<PaginatedDeliveryListResponse> {
    const skip = (query.page - 1) * query.limit;
    const where = { status: query.status, order: { outletId, paymentStatus: 'PAID' as const } };
    const [deliveries, total] = await prisma.$transaction([
      prisma.delivery.findMany({ where, include: orderChainInclude, orderBy: { createdAt: 'asc' }, skip, take: query.limit }),
      prisma.delivery.count({ where }),
    ]);
    return { data: deliveries.map(toDeliveryListItem), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  static async acceptDelivery(staffId: string, deliveryId: string, outletId: string) {
    return prisma.$transaction((tx) => runAcceptDeliveryTx(tx, staffId, deliveryId, outletId));
  }

  static async completeDelivery(staffId: string, deliveryId: string) {
    return prisma.$transaction((tx) => runCompleteDeliveryTx(tx, staffId, deliveryId));
  }

  static async getOrderSummary(staffId: string, deliveryId: string) {
    const delivery = await prisma.delivery.findFirst({
      where: { id: deliveryId, driverId: staffId },
      include: {
        order: {
          include: {
            items: { include: { laundryItem: true } },
          },
        },
      },
    });
    if (!delivery) throw new ResponseError(404, 'Delivery not found');
    return toDeliveryOrderSummary(delivery);
  }

  static async listDriverHistory(staffId: string, query: DeliveryHistoryQuery): Promise<PaginatedDeliveryHistoryResponse> {
    const skip = (query.page - 1) * query.limit;
    const dateFilter = query.fromDate ?? query.toDate
      ? { deliveredAt: { ...(query.fromDate && { gte: new Date(query.fromDate) }), ...(query.toDate && { lte: new Date(query.toDate) }) } }
      : {};
    const where = { driverId: staffId, status: DeliveryStatus.DELIVERED, ...dateFilter };
    const [deliveries, total] = await prisma.$transaction([
      prisma.delivery.findMany({ where, include: orderChainInclude, orderBy: { [query.sortBy]: query.order }, skip, take: query.limit }),
      prisma.delivery.count({ where }),
    ]);
    return { data: deliveries.map(toDeliveryHistoryItem), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }
}
