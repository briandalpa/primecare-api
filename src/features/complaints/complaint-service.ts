import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import type {
  ComplaintListQuery,
  ComplaintStatus,
  CreateComplaintInput,
  UpdateComplaintStatusInput,
} from './complaint-model';
import {
  toComplaintDetail,
  toComplaintListItem,
  toComplaintResponse,
  toComplaintStatusUpdate,
} from './complaint-model';

const COMPLAINT_RELATIONS = {
  customer: true,
  order: { include: { outlet: true } },
} as const;

function buildListWhere(
  role: string | undefined,
  userId: string,
  staffOutletId: string | null | undefined,
  query: ComplaintListQuery,
) {
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

export class ComplaintService {
  static async create(customerId: string, data: CreateComplaintInput) {
    const order = await prisma.order.findFirst({
      where: { id: data.orderId, pickupRequest: { customerId } },
    });
    if (!order) throw new ResponseError(404, 'Order not found');

    const COMPLAINT_ALLOWED_STATUSES = [
      'LAUNDRY_DELIVERED_TO_CUSTOMER',
      'COMPLETED',
    ];
    if (!COMPLAINT_ALLOWED_STATUSES.includes(order.status))
      throw new ResponseError(
        409,
        'Complaints can only be filed for delivered or completed orders',
      );

    const existing = await prisma.complaint.findFirst({
      where: { orderId: data.orderId },
    });
    if (existing)
      throw new ResponseError(409, 'A complaint already exists for this order');

    const complaint = await prisma.complaint.create({
      data: {
        orderId: data.orderId,
        customerId,
        description: data.description,
      },
    });

    return toComplaintResponse(complaint);
  }

  static async list(
    role: string | undefined,
    userId: string,
    staffOutletId: string | null | undefined,
    query: ComplaintListQuery,
  ) {
    if (role === 'OUTLET_ADMIN' && !staffOutletId) {
      return {
        data: [],
        meta: {
          page: query.page,
          limit: query.limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const where = buildListWhere(role, userId, staffOutletId, query);
    const skip = (query.page - 1) * query.limit;

    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        include: COMPLAINT_RELATIONS,
        orderBy: { [query.sortBy]: query.order },
        skip,
        take: query.limit,
      }),
      prisma.complaint.count({ where }),
    ]);

    return {
      data: complaints.map(toComplaintListItem),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  static async getById(
    role: string | undefined,
    userId: string,
    staffOutletId: string | null | undefined,
    complaintId: string,
  ) {
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: COMPLAINT_RELATIONS,
    });
    if (!complaint) throw new ResponseError(404, 'Complaint not found');

    if (!role && complaint.customerId !== userId)
      throw new ResponseError(404, 'Complaint not found');

    if (role === 'OUTLET_ADMIN' && complaint.order.outletId !== staffOutletId)
      throw new ResponseError(404, 'Complaint not found');

    return toComplaintDetail(complaint);
  }

  static async updateStatus(
    role: string,
    staffOutletId: string | null | undefined,
    complaintId: string,
    data: UpdateComplaintStatusInput,
  ) {
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { order: true },
    });
    if (!complaint) throw new ResponseError(404, 'Complaint not found');

    if (role === 'OUTLET_ADMIN' && complaint.order.outletId !== staffOutletId)
      throw new ResponseError(404, 'Complaint not found');

    const VALID_TRANSITIONS: Partial<Record<ComplaintStatus, ComplaintStatus>> =
      {
        OPEN: 'IN_REVIEW',
        IN_REVIEW: 'RESOLVED',
      };

    if (VALID_TRANSITIONS[complaint.status] !== data.status)
      throw new ResponseError(409, 'Invalid status transition');

    const updated = await prisma.complaint.update({
      where: { id: complaintId },
      data: { status: data.status },
    });

    return toComplaintStatusUpdate(updated);
  }
}
