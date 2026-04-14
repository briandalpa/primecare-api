import type { BypassRequest, Prisma } from '@/generated/prisma/client';

export type BypassItemInput = {
  laundryItemId: string;
  quantity: number;
};

export type CreateBypassRequestInput = {
  items: BypassItemInput[];
};

export enum BypassStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export type BypassRequestResponse = {
  id: string;
  orderId: string;
  station: string;
  workerName: string;
  status: BypassStatus;
  createdAt: Date;
  resolvedAt: Date | null;
};

// For CREATE response (minimal)
export type BypassRequestCreateResponse = {
  id: string;
  status: BypassStatus;
  createdAt: Date;
};

// For service responses
type BypassWithRelations = Prisma.BypassRequestGetPayload<{
  include: {
    stationRecord: {
      include: {
        order: true;
      };
    };
    worker: {
      include: {
        user: true;
      };
    };
    admin: {
      include: {
        user: true;
      };
    };
  };
}>;

export function toBypassCreateResponse(
  bypass: BypassRequest
): BypassRequestCreateResponse {
  return {
    id: bypass.id,
    status: bypass.status as BypassStatus,
    createdAt: bypass.createdAt,
  };
}

export function toBypassResponse(
  bypass: BypassWithRelations
): BypassRequestResponse {
  return {
    id: bypass.id,
    orderId: bypass.stationRecord?.order?.id ?? '',
    station: bypass.stationRecord?.station ?? '',
    workerName: bypass.worker?.user?.name ?? 'Unknown',
    status: bypass.status as BypassStatus,
    createdAt: bypass.createdAt,
    resolvedAt: bypass.resolvedAt,
  };
}

// For APPROVE response (PCS-129)
export type ApproveBypassResponse = {
  id: string;
  status: BypassStatus;
  adminId: string;
  problemDescription: string;
  resolvedAt: Date;
  orderStatus: string;
};

export function toApproveBypassResponse(
  bypass: BypassRequest,
  orderStatus: string
): ApproveBypassResponse {
  return {
    id: bypass.id,
    status: bypass.status as BypassStatus,
    adminId: bypass.adminId ?? '',
    problemDescription: bypass.problemDescription ?? '',
    resolvedAt: bypass.resolvedAt!,
    orderStatus,
  };
}

// For REJECT response (PCS-129)
export type RejectBypassResponse = {
  id: string;
  status: BypassStatus;
  adminId: string;
  resolvedAt: Date;
};

export function toRejectBypassResponse(bypass: BypassRequest): RejectBypassResponse {
  return {
    id: bypass.id,
    status: bypass.status as BypassStatus,
    adminId: bypass.adminId ?? '',
    resolvedAt: bypass.resolvedAt!,
  };
}

// For detail response (GET /bypass-requests/:id)
export type BypassItemResponse = {
  laundryItemId: string;
  itemName: string;
  quantity: number;
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
  status: BypassStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  referenceItems: BypassItemResponse[];
  workerItems: BypassItemResponse[];
};

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
    status: bypass.status as BypassStatus,
    createdAt: bypass.createdAt,
    resolvedAt: bypass.resolvedAt,
    referenceItems,
    workerItems,
  };
}