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
  resolvedAt?: Date | null;
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
    orderId: bypass.stationRecord.order.id,
    station: bypass.stationRecord.station,
    workerName: bypass.worker?.user?.name ?? 'Unknown',
    status: bypass.status as BypassStatus,
    createdAt: bypass.createdAt,
    resolvedAt: bypass.resolvedAt ?? undefined,
  };
}