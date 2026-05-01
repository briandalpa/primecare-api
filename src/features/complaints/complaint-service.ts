import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import type {
  ComplaintListQuery,
  CreateComplaintInput,
  UpdateComplaintStatusInput,
} from './complaint-model';
import {
  toComplaintDetail,
  toComplaintResponse,
  toComplaintStatusUpdate,
} from './complaint-model';
import { COMPLAINT_RELATIONS, VALID_TRANSITIONS, buildListWhere, assertOrderComplaintEligible, fetchComplaintsPage } from './complaint-helper';

export class ComplaintService {
  static async create(customerId: string, data: CreateComplaintInput) {
    await assertOrderComplaintEligible(data.orderId, customerId);
    const complaint = await prisma.complaint.create({
      data: { orderId: data.orderId, customerId, description: data.description },
    });
    return toComplaintResponse(complaint);
  }

  static async list(role: string | undefined, userId: string, staffOutletId: string | null | undefined, query: ComplaintListQuery) {
    if (role === 'OUTLET_ADMIN' && !staffOutletId)
      return { data: [], meta: { page: query.page, limit: query.limit, total: 0, totalPages: 0 } };
    return fetchComplaintsPage(buildListWhere(role, userId, staffOutletId, query), query);
  }

  static async getById(role: string | undefined, userId: string, staffOutletId: string | null | undefined, complaintId: string) {
    const complaint = await prisma.complaint.findUnique({ where: { id: complaintId }, include: COMPLAINT_RELATIONS });
    if (!complaint) throw new ResponseError(404, 'Complaint not found');
    if (!role && complaint.customerId !== userId) throw new ResponseError(404, 'Complaint not found');
    if (role === 'OUTLET_ADMIN' && complaint.order.outletId !== staffOutletId) throw new ResponseError(404, 'Complaint not found');
    return toComplaintDetail(complaint);
  }

  static async updateStatus(role: string, staffOutletId: string | null | undefined, complaintId: string, data: UpdateComplaintStatusInput) {
    const complaint = await prisma.complaint.findUnique({ where: { id: complaintId }, include: { order: true } });
    if (!complaint) throw new ResponseError(404, 'Complaint not found');
    if (role === 'OUTLET_ADMIN' && complaint.order.outletId !== staffOutletId)
      throw new ResponseError(404, 'Complaint not found');
    if (VALID_TRANSITIONS[complaint.status] !== data.status)
      throw new ResponseError(409, 'Invalid status transition');
    const updated = await prisma.complaint.update({ where: { id: complaintId }, data: { status: data.status } });
    return toComplaintStatusUpdate(updated);
  }
}
