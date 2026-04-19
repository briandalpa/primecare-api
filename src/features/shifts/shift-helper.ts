import type { Staff } from '@/generated/prisma/client';
import { ResponseError } from '@/error/response-error';
import type { ShiftResponse } from './shift-model';

export const resolveManagedOutletId = (
  staff: Staff,
  outletId?: string,
) => {
  if (staff.role === 'OUTLET_ADMIN') {
    if (!staff.outletId) {
      throw new ResponseError(422, 'Outlet admin is not assigned to an outlet');
    }
    if (outletId && outletId !== staff.outletId) {
      throw new ResponseError(403, 'Forbidden');
    }

    return staff.outletId;
  }

  return outletId;
};

export const toShiftResponse = (shift: {
  id: string;
  staffId: string;
  startTime: Date;
  endTime: Date | null;
  staff: { workerType: string | null; user: { name: string | null } };
  outlet: { id: string; name: string };
}): ShiftResponse => ({
  id: shift.id,
  staffId: shift.staffId,
  workerType: shift.staff.workerType,
  workerName: shift.staff.user.name,
  outletId: shift.outlet.id,
  outletName: shift.outlet.name,
  startedAt: shift.startTime,
  endedAt: shift.endTime,
  isActive: shift.endTime === null,
});