import type { BypassRequest } from '@/generated/prisma/client';

export type BypassItemInput = {
  laundryItemId: string;
  quantity: number;
};

export type CreateBypassRequestInput = {
  items: BypassItemInput[];
};

export type BypassRequestResponse = {
  bypassRequestId: string;
  stationRecordId: string;
  status: string;
  createdAt: Date;
};

export function toBypassResponse(
  bypass: BypassRequest
): BypassRequestResponse {
  return {
    bypassRequestId: bypass.id,
    stationRecordId: bypass.stationRecordId,
    status: bypass.status,
    createdAt: bypass.createdAt,
  };
}