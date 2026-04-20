import type { BypassRequest, Prisma } from '@/generated/prisma/client';
export type { BypassStatus } from '@/generated/prisma/client';

export type BypassItemInput = {
  laundryItemId: string;
  quantity: number;
};

export type CreateBypassRequestInput = {
  items: BypassItemInput[];
  notes?: string;
};

export type ApproveBypassInput = {
  password: string;
  problemDescription: string;
};

export type RejectBypassInput = {
  password: string;
};

export type AdminContext = {
  staffId: string;
  userId: string;
  role: string;
  outletId: string | null | undefined;
};

export type BypassItemResponse = {
  laundryItemId: string;
  itemName: string;
  quantity: number;
};

export type BypassRequestCreateResponse = {
  id: string;
  status: string;
  createdAt: Date;
};

export type BypassRequestResponse = {
  id: string;
  orderId: string;
  station: string;
  workerName: string;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
};

export type ApproveBypassResponse = {
  id: string;
  status: string;
  adminId: string;
  problemDescription: string;
  resolvedAt: Date;
  orderStatus: string;
};

export type RejectBypassResponse = {
  id: string;
  status: string;
  adminId: string;
  resolvedAt: Date;
};

export type BypassRequestDetailResponse = {
  id: string;
  orderId: string;
  stationRecordId: string;
  station: string;
  workerName: string;
  workerId: string;
  adminId: string | null;
  problemDescription: string | null;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
  referenceItems: BypassItemResponse[];
  workerItems: BypassItemResponse[];
};

type BypassWithRelations = Prisma.BypassRequestGetPayload<{
  include: {
    stationRecord: { include: { order: true } };
    worker: { include: { user: true } };
    admin: { include: { user: true } };
  };
}>;

type BypassWithDetailRelations = Prisma.BypassRequestGetPayload<{
  include: {
    stationRecord: {
      include: {
        order: true;
        stationItems: { include: { laundryItem: true } };
      };
    };
    worker: { include: { user: true } };
    admin: { include: { user: true } };
  };
}>;

export function toBypassCreateResponse(bypass: BypassRequest): BypassRequestCreateResponse {
  return {
    id: bypass.id,
    status: bypass.status,
    createdAt: bypass.createdAt,
  };
}

export function toBypassResponse(bypass: BypassWithRelations): BypassRequestResponse {
  return {
    id: bypass.id,
    orderId: bypass.stationRecord?.order?.id ?? '',
    station: bypass.stationRecord?.station ?? '',
    workerName: bypass.worker?.user?.name ?? 'Unknown',
    status: bypass.status,
    createdAt: bypass.createdAt,
    resolvedAt: bypass.resolvedAt,
  };
}

export function toApproveBypassResponse(
  bypass: BypassRequest,
  orderStatus: string
): ApproveBypassResponse {
  if (!bypass.resolvedAt) throw new Error('Invariant: resolvedAt must be set on an approved bypass');
  return {
    id: bypass.id,
    status: bypass.status,
    adminId: bypass.adminId ?? '',
    problemDescription: bypass.problemDescription ?? '',
    resolvedAt: bypass.resolvedAt,
    orderStatus,
  };
}

export function toRejectBypassResponse(bypass: BypassRequest): RejectBypassResponse {
  if (!bypass.resolvedAt) throw new Error('Invariant: resolvedAt must be set on a rejected bypass');
  return {
    id: bypass.id,
    status: bypass.status,
    adminId: bypass.adminId ?? '',
    resolvedAt: bypass.resolvedAt,
  };
}

export function toBypassDetailResponse(
  bypass: BypassWithDetailRelations,
  referenceItems: BypassItemResponse[]
): BypassRequestDetailResponse {
  const workerItems: BypassItemResponse[] = bypass.stationRecord.stationItems.map((item) => ({
    laundryItemId: item.laundryItemId,
    itemName: item.laundryItem.name,
    quantity: item.quantity,
  }));

  return {
    id: bypass.id,
    orderId: bypass.stationRecord?.order?.id ?? '',
    stationRecordId: bypass.stationRecordId,
    station: bypass.stationRecord?.station ?? '',
    workerName: bypass.worker?.user?.name ?? 'Unknown',
    workerId: bypass.workerId,
    adminId: bypass.adminId,
    problemDescription: bypass.problemDescription,
    status: bypass.status,
    createdAt: bypass.createdAt,
    resolvedAt: bypass.resolvedAt,
    referenceItems,
    workerItems,
  };
}
