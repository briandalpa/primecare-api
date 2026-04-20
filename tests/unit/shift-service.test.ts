jest.mock('@/application/database', () => ({
  prisma: {
    shift: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    staff: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import { ShiftService } from '@/features/shifts/shift-service';

describe('ShiftService', () => {
  const superAdmin = { id: 'staff-super', role: 'SUPER_ADMIN', outletId: null } as any;
  const outletAdmin = { id: 'staff-admin', role: 'OUTLET_ADMIN', outletId: 'outlet-1' } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a worker shift', async () => {
    (prisma.staff.findUnique as jest.Mock).mockResolvedValue({
      id: 'worker-1',
      role: 'WORKER',
      outletId: 'outlet-1',
      workerType: 'WASHING',
      user: { name: 'Wash Worker' },
      outlet: { id: 'outlet-1', name: 'Outlet A' },
    });
    (prisma.shift.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.shift.create as jest.Mock).mockResolvedValue({
      id: 'shift-1',
      staffId: 'worker-1',
      startTime: new Date('2026-04-20T08:00:00.000Z'),
      endTime: null,
      staff: { workerType: 'WASHING', user: { name: 'Wash Worker' } },
      outlet: { id: 'outlet-1', name: 'Outlet A' },
    });

    const result = await ShiftService.createShift(outletAdmin, {
      staffId: 'worker-1',
      startedAt: '2026-04-20T08:00:00.000Z',
    });

    expect(result.isActive).toBe(true);
  });

  it('blocks duplicate active shifts', async () => {
    (prisma.staff.findUnique as jest.Mock).mockResolvedValue({
      id: 'worker-1',
      role: 'WORKER',
      outletId: 'outlet-1',
      workerType: 'WASHING',
      user: { name: 'Wash Worker' },
      outlet: { id: 'outlet-1', name: 'Outlet A' },
    });
    (prisma.shift.findFirst as jest.Mock).mockResolvedValue({ id: 'shift-active' });

    await expect(
      ShiftService.createShift(outletAdmin, {
        staffId: 'worker-1',
        startedAt: '2026-04-20T08:00:00.000Z',
      }),
    ).rejects.toThrow(new ResponseError(409, 'Worker already has an active shift'));
  });

  it('lists shifts with filters', async () => {
    (prisma.$transaction as jest.Mock).mockResolvedValue([
      [{
        id: 'shift-1',
        staffId: 'worker-1',
        startTime: new Date('2026-04-20T08:00:00.000Z'),
        endTime: null,
        staff: { workerType: 'WASHING', user: { name: 'Wash Worker' } },
        outlet: { id: 'outlet-1', name: 'Outlet A' },
      }],
      1,
    ]);

    const result = await ShiftService.getShifts(outletAdmin, {
      page: 1,
      limit: 10,
      isActive: true,
    });

    expect(result.meta.total).toBe(1);
    expect(result.data[0].isActive).toBe(true);
  });

  it('allows super admin outlet filtering', async () => {
    (prisma.$transaction as jest.Mock).mockResolvedValue([[], 0]);

    await ShiftService.getShifts(superAdmin, {
      page: 1,
      limit: 10,
      outletId: 'outlet-2',
    });

    const findManyArgs = (prisma.shift.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyArgs.where.outletId).toBe('outlet-2');
  });

  it('ends an active shift', async () => {
    (prisma.shift.findUnique as jest.Mock).mockResolvedValue({
      id: 'shift-1',
      outletId: 'outlet-1',
      staffId: 'worker-1',
      startTime: new Date('2026-04-20T08:00:00.000Z'),
      endTime: null,
      staff: { workerType: 'WASHING', user: { name: 'Wash Worker' } },
      outlet: { id: 'outlet-1', name: 'Outlet A' },
    });
    (prisma.shift.update as jest.Mock).mockResolvedValue({
      id: 'shift-1',
      outletId: 'outlet-1',
      staffId: 'worker-1',
      startTime: new Date('2026-04-20T08:00:00.000Z'),
      endTime: new Date('2026-04-20T17:00:00.000Z'),
      staff: { workerType: 'WASHING', user: { name: 'Wash Worker' } },
      outlet: { id: 'outlet-1', name: 'Outlet A' },
    });

    const result = await ShiftService.endShift(outletAdmin, 'shift-1');

    expect(result.isActive).toBe(false);
  });
});