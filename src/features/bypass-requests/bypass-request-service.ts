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

  static async approve(adminId: string, bypassId: string) {
    const bypass = await prisma.bypassRequest.findUnique({
      where: { id: bypassId },
      include: {
        stationRecord: true,
      },
    });

    if (!bypass) {
      throw new ResponseError(404, "Bypass request not found");
    }

    if (bypass.status !== "PENDING") {
      throw new ResponseError(400, "Bypass already processed");
    }

    const updated = await prisma.bypassRequest.update({
      where: { id: bypassId },
      data: {
        status: "APPROVED",
        adminId,
      },
    });

    await prisma.stationRecord.update({
      where: { id: bypass.stationRecordId },
      data: {
        status: "COMPLETED",
      },
    });

    return updated;
  }

  static async findAll(adminId: string, role: string, outletId?: string) {
  const where: any = {
    status: "PENDING",
  };

  // role logic
  if (role === "OUTLET_ADMIN") {
    where.stationRecord = {
      outletId: outletId,
    };
  }

  const bypasses = await prisma.bypassRequest.findMany({
    where,
    include: {
      stationRecord: {
        include: {
          order: true,
        },
      },
      worker: true,
      admin: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

    return bypasses.map(toBypassResponse);
  }

  static async reject(adminId: string, bypassId: string) {
  const bypass = await prisma.bypassRequest.findUnique({
    where: { id: bypassId },
  });

  if (!bypass) {
    throw new ResponseError(404, "Bypass request not found");
  }

  if (bypass.status !== "PENDING") {
    throw new ResponseError(400, "Bypass already processed");
  }

  const updated = await prisma.bypassRequest.update({
    where: { id: bypassId },
    data: {
      status: "REJECTED",
      adminId,
    },
  });

  return updated;
}
}