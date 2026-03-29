import { prisma } from '../../application/database';
import { ResponseError } from '../../error/response-error';
import { Prisma } from '../../generated/prisma/client';
import { CreateBypassRequestInput, toBypassResponse } from './bypass-request-model';

export class BypassRequestService {
  static async approve(
    adminId: string,
    bypassId: string,
    problemDescription: string
  ) {
    return prisma.$transaction(async (tx) => {
      const bypass = await tx.bypassRequest.findUnique({
        where: { id: bypassId },
        include: {
          stationRecord: {
            include: {
              order: true,
            },
          },
        },
      });

      if (!bypass) {
        throw new ResponseError(404, 'Bypass request not found');
      }

      if (bypass.status !== 'PENDING') {
        throw new ResponseError(400, 'Bypass already processed');
      }

      // update bypass
      const updated = await tx.bypassRequest.update({
        where: { id: bypassId },
        data: {
          status: 'APPROVED',
          adminId: adminId,
          problemDescription,
          resolvedAt: new Date(),
        },
      });

      // complete station record
      await tx.stationRecord.update({
        where: { id: bypass.stationRecordId },
        data: {
          status: 'COMPLETED',
        },
      });

      // FIX: advance order status
      const currentStatus = bypass.stationRecord.order.status;

      let nextStatus = currentStatus;

      if (currentStatus === 'LAUNDRY_BEING_WASHED') {
        nextStatus = 'LAUNDRY_BEING_IRONED';
      } else if (currentStatus === 'LAUNDRY_BEING_IRONED') {
        nextStatus = 'LAUNDRY_BEING_PACKED';
      }

      await tx.order.update({
        where: { id: bypass.stationRecord.order.id },
        data: {
          status: nextStatus,
        },
      });

      return toBypassResponse(updated);
    });
  }

  static async findAll(
    staffId: string,
    role: string,
    outletId?: string
  ) {
    const where: Prisma.BypassRequestWhereInput = {
      status: 'PENDING',
    };

    if (role === 'OUTLET_ADMIN' && outletId) {
      where.stationRecord = {
        order: {
          outletId: outletId,
        },
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
      },
    });

    return bypasses.map(toBypassResponse);
  }

  static async create(workerId: string, data: CreateBypassRequestInput) {
    const stationRecord = await prisma.stationRecord.findUnique({
      where: { id: data.stationRecordId },
    });

    if (!stationRecord) {
      throw new ResponseError(404, "Station record not found");
    }

    const bypass = await prisma.bypassRequest.create({
      data: {
        stationRecordId: data.stationRecordId,
        workerId: stationRecord.staffId,
        adminId: null,
        status: "PENDING",
        problemDescription: data.mismatchDetails,
      },
    });

    return toBypassResponse(bypass);
  }
}