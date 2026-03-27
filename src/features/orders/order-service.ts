import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import { OrderStatus } from '@/generated/prisma/enums';
import { CustomerOrderListQuery } from './order-model';

export class OrderService {

  static async listOrders(userId: string, query: CustomerOrderListQuery) {
    const skip = (query.page - 1) * query.limit;
    const where = {
      pickupRequest: { customerId: userId },
      ...(query.status ? { status: query.status } : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          outlet: { select: { id: true, name: true } },
          items: { include: { laundryItem: { select: { id: true, name: true, slug: true } } } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  static async getOrderDetail(userId: string, orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        outlet: { select: { id: true, name: true } },
        items: { include: { laundryItem: { select: { id: true, name: true, slug: true } } } },
        stationRecords: {
          include: {
            staff: { include: { user: { select: { id: true, name: true } } } },
            stationItems: true,
            bypassRequests: { select: { id: true, status: true } },
          },
        },
        pickupRequest: { include: { address: true } },
      },
    });

    if (!order || order.pickupRequest.customerId !== userId) {
      throw new ResponseError(404, 'Order not found');
    }

    return order;
  }

  static async confirmReceipt(userId: string, orderId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { pickupRequest: true },
      });
      if (!order) throw new ResponseError(404, 'Order not found');
      if (order.pickupRequest.customerId !== userId) throw new ResponseError(403, 'Forbidden');
      if (order.status !== 'LAUNDRY_DELIVERED_TO_CUSTOMER') {
        throw new ResponseError(400, 'Order cannot be confirmed at this stage');
      }
      return tx.order.update({
        where: { id: orderId },
        data: { status: 'COMPLETED', confirmedAt: new Date() },
      });
    });
  }
}
