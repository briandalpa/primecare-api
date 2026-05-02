import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import { DeliveryStatus } from '@/generated/prisma/enums';
import {
  DeliveryListQuery,
  DeliveryHistoryQuery,
} from '@/validations/delivery-validation';
import {
  toDeliveryListItem,
  toDeliveryHistoryItem,
  toDeliveryOrderSummary,
  PaginatedDeliveryListResponse,
  PaginatedDeliveryHistoryResponse,
} from './delivery-model';
import { orderChainInclude, runAcceptDeliveryTx, runCompleteDeliveryTx } from './delivery-helper';

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
