import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import type { ComplaintListQuery, ComplaintStatus } from './complaint-model';
import { toComplaintListItem } from './complaint-model';

export const COMPLAINT_RELATIONS = {
  customer: true,
  order: { include: { outlet: true } },
} as const;

export const VALID_TRANSITIONS: Partial<Record<ComplaintStatus, ComplaintStatus>> = { OPEN: 'IN_REVIEW', IN_REVIEW: 'RESOLVED' };

export function buildListWhere(role: string | undefined, userId: string, staffOutletId: string | null | undefined, query: ComplaintListQuery) {
  const where: Record<string, unknown> = {};
  if (!role) {
    where.customerId = userId;
  } else if (role === 'OUTLET_ADMIN') {
    where.order = { is: { outletId: staffOutletId } };
  } else if (role === 'SUPER_ADMIN' && query.outletId) {
    where.order = { is: { outletId: query.outletId } };
  }
  if (query.status) where.status = query.status;
  if (query.orderId) where.orderId = query.orderId;
  return where;
}

export async function assertOrderComplaintEligible(orderId: string, customerId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, pickupRequest: { customerId } } });
  if (!order) throw new ResponseError(404, 'Order not found');
  const ALLOWED = ['LAUNDRY_DELIVERED_TO_CUSTOMER', 'COMPLETED'];
  if (!ALLOWED.includes(order.status))
    throw new ResponseError(409, 'Complaints can only be filed for delivered or completed orders');
  const existing = await prisma.complaint.findFirst({ where: { orderId } });
  if (existing) throw new ResponseError(409, 'A complaint already exists for this order');
}

export async function fetchComplaintsPage(where: Record<string, unknown>, query: ComplaintListQuery) {
  const skip = (query.page - 1) * query.limit;
  const [complaints, total] = await Promise.all([
    prisma.complaint.findMany({ where, include: COMPLAINT_RELATIONS, orderBy: { [query.sortBy]: query.order }, skip, take: query.limit }),
    prisma.complaint.count({ where }),
  ]);
  return { data: complaints.map(toComplaintListItem), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}
