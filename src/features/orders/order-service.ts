import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import { OrderListQuery, toOrderDetail, toOrderListItem } from './order-model';

const VALID_ORDER_SORT = ['createdAt', 'totalPrice', 'totalWeightKg'] as const;
type OrderSortField = typeof VALID_ORDER_SORT[number];

// Builds Prisma where clause for customer order list.
const buildListWhere = (customerId: string, query: OrderListQuery) => {
  const where: Record<string, unknown> = {
    pickupRequest: { customerId },
  };
  if (query.status) where.status = query.status;
  if (query.search) where.id = { contains: query.search, mode: 'insensitive' };
  if (query.fromDate || query.toDate) {
    where.createdAt = {
      ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
      ...(query.toDate   ? { lte: new Date(query.toDate) }   : {}),
    };
  }
  return where;
};

export class OrderService {
  static async listOrders(customerId: string, query: OrderListQuery) {
    const skip   = (query.page - 1) * query.limit;
    const where  = buildListWhere(customerId, query);
    const sortBy: OrderSortField = VALID_ORDER_SORT.includes(query.sortBy as OrderSortField)
      ? (query.sortBy as OrderSortField)
      : 'createdAt';

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take:    query.limit,
        orderBy: { [sortBy]: query.order },
        include: {
          outlet:        { select: { id: true, name: true } },
          pickupRequest: { select: { customerUser: { select: { id: true, name: true } } } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      data: orders.map(toOrderListItem),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  static async getOrderDetail(customerId: string, orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        outlet:        { select: { id: true, name: true } },
        items:         { include: { laundryItem: { select: { id: true, name: true } } } },
        stationRecords: {
          include: { staff: { include: { user: { select: { id: true, name: true } } } } },
          orderBy: { createdAt: 'asc' },
        },
        payment:  { select: { id: true, amount: true, gateway: true, status: true, paidAt: true } },
        delivery: { select: { id: true, status: true, deliveredAt: true, createdAt: true } },
        pickupRequest: {
          select: { customerId: true, customerUser: { select: { id: true, name: true } } },
        },
      },
    });

    if (!order) throw new ResponseError(404, 'Order not found');
    if (order.pickupRequest.customerId !== customerId)
      throw new ResponseError(404, 'Order not found');

    return toOrderDetail(order);
  }

  static async confirmReceipt(customerId: string, orderId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { pickupRequest: true },
      });
      if (!order) throw new ResponseError(404, 'Order not found');
      if (order.pickupRequest.customerId !== customerId)
        throw new ResponseError(404, 'Order not found');
      if (order.status !== 'LAUNDRY_DELIVERED_TO_CUSTOMER')
        throw new ResponseError(409, 'Order cannot be confirmed at this stage');
      return tx.order.update({
        where: { id: orderId },
        data:  { status: 'COMPLETED', confirmedAt: new Date() },
      });
    });
  }
}
