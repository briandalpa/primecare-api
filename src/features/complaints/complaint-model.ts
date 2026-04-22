import type { ComplaintStatus, Prisma } from '@/generated/prisma/client';
export type { ComplaintStatus } from '@/generated/prisma/client';

export type CreateComplaintInput = {
  orderId: string;
  description: string;
};

export type UpdateComplaintStatusInput = {
  status: 'IN_REVIEW' | 'RESOLVED';
};

export type ComplaintListQuery = {
  page: number;
  limit: number;
  status?: ComplaintStatus;
  outletId?: string;
  orderId?: string;
  sortBy: 'createdAt' | 'status';
  order: 'asc' | 'desc';
};

export type ComplaintResponse = {
  id: string;
  orderId: string;
  customerId: string;
  description: string;
  status: ComplaintStatus;
  createdAt: Date;
};

export type ComplaintListItem = {
  id: string;
  orderId: string;
  customerName: string;
  outletName: string;
  description: string;
  status: ComplaintStatus;
  createdAt: Date;
};

export type ComplaintDetailResponse = {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  outletName: string;
  description: string;
  status: ComplaintStatus;
  createdAt: Date;
};

export type ComplaintStatusUpdateResponse = {
  id: string;
  status: ComplaintStatus;
  updatedAt: Date;
};

type ComplaintWithCreate = Prisma.ComplaintGetPayload<Record<string, never>>;

type ComplaintWithRelations = Prisma.ComplaintGetPayload<{
  include: {
    customer: true;
    order: { include: { outlet: true } };
  };
}>;

export function toComplaintResponse(complaint: ComplaintWithCreate): ComplaintResponse {
  return {
    id: complaint.id,
    orderId: complaint.orderId,
    customerId: complaint.customerId,
    description: complaint.description,
    status: complaint.status,
    createdAt: complaint.createdAt,
  };
}

export function toComplaintListItem(complaint: ComplaintWithRelations): ComplaintListItem {
  return {
    id: complaint.id,
    orderId: complaint.orderId,
    customerName: complaint.customer.name ?? '',
    outletName: complaint.order.outlet.name,
    description: complaint.description,
    status: complaint.status,
    createdAt: complaint.createdAt,
  };
}

export function toComplaintDetail(complaint: ComplaintWithRelations): ComplaintDetailResponse {
  return {
    id: complaint.id,
    orderId: complaint.orderId,
    customerId: complaint.customerId,
    customerName: complaint.customer.name ?? '',
    outletName: complaint.order.outlet.name,
    description: complaint.description,
    status: complaint.status,
    createdAt: complaint.createdAt,
  };
}

export function toComplaintStatusUpdate(complaint: ComplaintWithCreate): ComplaintStatusUpdateResponse {
  return {
    id: complaint.id,
    status: complaint.status,
    updatedAt: complaint.updatedAt,
  };
}
