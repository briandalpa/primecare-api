import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import {
  CreateBypassRequestInput,
  toBypassResponse,
} from './bypass-request-model';

const checkStationRecordExists = async (stationRecordId: string) => {
  const record = await prisma.stationRecord.findUnique({
    where: { id: stationRecordId },
  });

  if (!record) {
    throw new ResponseError(404, 'Station record not found');
  }

  return record;
};

const checkPendingBypass = async (stationRecordId: string) => {
  const existing = await prisma.bypassRequest.findFirst({
    where: {
      stationRecordId,
      status: 'PENDING',
    },
  });

  if (existing) {
    throw new ResponseError(409, 'Bypass already requested');
  }
};

export class BypassRequestService {
  static async create(adminId: string, data: CreateBypassRequestInput) {
    const stationRecord = await checkStationRecordExists(
      data.stationRecordId
    );

    await checkPendingBypass(data.stationRecordId);

    const bypass = await prisma.bypassRequest.create({
      data: {
        stationRecordId: data.stationRecordId,
        workerId: stationRecord.staffId,
        adminId: adminId,
        status: 'PENDING',
        problemDescription: data.mismatchDetails,
      },
    });

    return toBypassResponse(bypass);
  }
}