import { prisma } from '@/application/database';
import type { Staff } from '@/generated/prisma/client';
import { ResponseError } from '@/error/response-error';
import { resolveManagedOutletId, toShiftResponse } from './shift-helper';
import type { CreateShiftInput, ShiftListQuery } from './shift-model';

const SHIFT_INCLUDE = {
  staff: { include: { user: { select: { name: true } } } },
  outlet: { select: { id: true, name: true } },
} as const;

export class ShiftService {
  static async createShift(staff: Staff, data: CreateShiftInput) {
    const worker = await prisma.staff.findUnique({
      where: { id: data.staffId },
      include: SHIFT_INCLUDE,
    });

    if (!worker || worker.role !== 'WORKER' || !worker.outletId) {
      throw new ResponseError(404, 'Worker not found');
    }

    resolveManagedOutletId(staff, worker.outletId);

    const activeShift = await prisma.shift.findFirst({
      where: { staffId: worker.id, endTime: null },
    });

    if (activeShift) {
      throw new ResponseError(409, 'Worker already has an active shift');
    }

    const shift = await prisma.shift.create({
      data: {
        staffId: worker.id,
        outletId: worker.outletId,
        startTime: new Date(data.startedAt),
        endTime: null,
      },
      include: SHIFT_INCLUDE,
    });

    return toShiftResponse(shift);
  }

  static async getShifts(staff: Staff, query: ShiftListQuery) {
    const outletId = resolveManagedOutletId(staff, query.outletId);
    const where = {
      ...(outletId ? { outletId } : {}),
      ...(query.staffId ? { staffId: query.staffId } : {}),
      ...(query.isActive === undefined
        ? {}
        : query.isActive
          ? { endTime: null }
          : { NOT: { endTime: null } }),
    };
    const skip = (query.page - 1) * query.limit;

    const [shifts, total] = await prisma.$transaction([
      prisma.shift.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { startTime: 'desc' },
        include: SHIFT_INCLUDE,
      }),
      prisma.shift.count({ where }),
    ]);

    return {
      data: shifts.map(toShiftResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  static async endShift(staff: Staff, shiftId: string) {
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: SHIFT_INCLUDE,
    });

    if (!shift) {
      throw new ResponseError(404, 'Shift not found');
    }

    resolveManagedOutletId(staff, shift.outletId);

    if (shift.endTime) {
      throw new ResponseError(409, 'Shift has already ended');
    }

    const updatedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: { endTime: new Date() },
      include: SHIFT_INCLUDE,
    });

    return toShiftResponse(updatedShift);
  }
}