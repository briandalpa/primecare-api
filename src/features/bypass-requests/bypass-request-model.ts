import type { BypassRequest } from '@/generated/prisma/client';

export type CreateBypassRequestInput = {
  stationRecordId: string;
  mismatchDetails: string;
};

export type BypassRequestResponse = {
  id: string;
  stationRecordId: string;
  adminId: string | null;
  status: string;
  problemDescription: string | null;
  createdAt: Date;
};

export function toBypassResponse(
  bypass: BypassRequest
): BypassRequestResponse {
  return {
    id: bypass.id,
    stationRecordId: bypass.stationRecordId,
    adminId: bypass.adminId,
    status: bypass.status,
    problemDescription: bypass.problemDescription,
    createdAt: bypass.createdAt,
  };
}