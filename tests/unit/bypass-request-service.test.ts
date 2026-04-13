const mockTx = {
  stationRecord: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  orderItem: {
    findMany: jest.fn(),
  },
  stationItem: {
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
  bypassRequest: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

const mockPrisma = {
  bypassRequest: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('@/application/database', () => ({
  prisma: {
    $transaction: jest.fn((callback: (tx: typeof mockTx) => Promise<any>) => callback(mockTx)),
    bypassRequest: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import { BypassRequestService } from '@/features/bypass-requests/bypass-request-service';
import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import { BypassStatus } from '@/features/bypass-requests/bypass-request-model';

describe('BypassRequestService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(
      (callback: (tx: typeof mockTx) => Promise<any>) => callback(mockTx)
    );
    (prisma.bypassRequest.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.bypassRequest.count as jest.Mock).mockResolvedValue(0);
  });

  describe('create', () => {
    const workerId = 'worker-1';
    const orderId = 'order-1';
    const stationRecordId = 'sr-1';

    it('throws 404 when StationRecord not found', async () => {
      mockTx.stationRecord.findUnique.mockResolvedValue(null);

      await expect(
        BypassRequestService.create(workerId, orderId, 'WASHING', {
          items: [{ laundryItemId: 'item-1', quantity: 5 }],
        })
      ).rejects.toThrow(new ResponseError(404, 'Station record not found'));
    });

    it('throws 403 when worker does not own the station', async () => {
      mockTx.stationRecord.findUnique.mockResolvedValue({
        id: stationRecordId,
        orderId,
        station: 'WASHING',
        staffId: 'other-worker',
        status: 'IN_PROGRESS',
        stationItems: [],
      });

      await expect(
        BypassRequestService.create(workerId, orderId, 'WASHING', {
          items: [{ laundryItemId: 'item-1', quantity: 5 }],
        })
      ).rejects.toThrow(new ResponseError(403, 'You are not assigned to this station'));
    });

    it('throws 400 when quantities match (no mismatch for WASHING)', async () => {
      mockTx.stationRecord.findUnique.mockResolvedValue({
        id: stationRecordId,
        orderId,
        station: 'WASHING',
        staffId: workerId,
        status: 'IN_PROGRESS',
        stationItems: [],
      });

      mockTx.orderItem.findMany.mockResolvedValue([
        { laundryItemId: 'item-1', quantity: 5 },
        { laundryItemId: 'item-2', quantity: 3 },
      ]);

      await expect(
        BypassRequestService.create(workerId, orderId, 'WASHING', {
          items: [
            { laundryItemId: 'item-1', quantity: 5 },
            { laundryItemId: 'item-2', quantity: 3 },
          ],
        })
      ).rejects.toThrow(new ResponseError(400, 'No quantity mismatch detected'));
    });

    it('throws 409 when pending bypass already exists', async () => {
      mockTx.stationRecord.findUnique.mockResolvedValue({
        id: stationRecordId,
        orderId,
        station: 'WASHING',
        staffId: workerId,
        status: 'IN_PROGRESS',
        stationItems: [],
      });

      mockTx.orderItem.findMany.mockResolvedValue([
        { laundryItemId: 'item-1', quantity: 5 },
      ]);

      mockTx.bypassRequest.findFirst.mockResolvedValue({
        id: 'bp-1',
        status: 'PENDING',
      });

      await expect(
        BypassRequestService.create(workerId, orderId, 'WASHING', {
          items: [{ laundryItemId: 'item-1', quantity: 3 }], // mismatch
        })
      ).rejects.toThrow(
        new ResponseError(409, 'A pending bypass request already exists for this station')
      );
    });

    it('creates BypassRequest + StationItems on valid mismatch', async () => {
      const createdBypass = {
        id: 'bp-1',
        stationRecordId,
        workerId,
        adminId: null,
        problemDescription: null,
        status: 'PENDING',
        createdAt: new Date(),
      };

      mockTx.stationRecord.findUnique.mockResolvedValue({
        id: stationRecordId,
        orderId,
        station: 'WASHING',
        staffId: workerId,
        status: 'IN_PROGRESS',
        stationItems: [],
      });

      mockTx.orderItem.findMany.mockResolvedValue([
        { laundryItemId: 'item-1', quantity: 5 },
      ]);

      mockTx.bypassRequest.findFirst.mockResolvedValue(null);
      mockTx.stationItem.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.stationItem.create.mockResolvedValue({
        id: 'si-1',
        stationRecordId,
        laundryItemId: 'item-1',
        quantity: 3,
      });
      mockTx.bypassRequest.create.mockResolvedValue(createdBypass);
      mockTx.stationRecord.update.mockResolvedValue({
        id: stationRecordId,
        status: 'BYPASS_REQUESTED',
      });

      const result = await BypassRequestService.create(workerId, orderId, 'WASHING', {
        items: [{ laundryItemId: 'item-1', quantity: 3 }], // mismatch
      });

      expect(mockTx.stationItem.deleteMany).toHaveBeenCalledWith({
        where: { stationRecordId },
      });

      expect(mockTx.stationItem.create).toHaveBeenCalledWith({
        data: {
          stationRecordId,
          laundryItemId: 'item-1',
          quantity: 3,
        },
      });

      expect(mockTx.bypassRequest.create).toHaveBeenCalledWith({
        data: {
          stationRecordId,
          workerId,
          adminId: null,
          status: 'PENDING',
          problemDescription: null,
        },
      });

      expect(mockTx.stationRecord.update).toHaveBeenCalledWith({
        where: { id: stationRecordId },
        data: { status: 'BYPASS_REQUESTED' },
      });

      expect(result).toEqual({
        id: 'bp-1',
        status: 'PENDING',
        createdAt: createdBypass.createdAt,
      });
    });

    it('uses correct reference source for IRONING station', async () => {
      const prevStationId = 'sr-washing';
      mockTx.stationRecord.findUnique
        .mockResolvedValueOnce({
          id: stationRecordId,
          orderId,
          station: 'IRONING',
          staffId: workerId,
          status: 'IN_PROGRESS',
          stationItems: [],
        })
        .mockResolvedValueOnce({
          id: prevStationId,
          orderId,
          station: 'WASHING',
          stationItems: [{ laundryItemId: 'item-1', quantity: 5 }],
        });

      mockTx.bypassRequest.findFirst.mockResolvedValue(null);
      mockTx.stationItem.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.stationItem.create.mockResolvedValue({});
      mockTx.bypassRequest.create.mockResolvedValue({
        id: 'bp-1',
        stationRecordId,
        workerId,
        adminId: null,
        problemDescription: null,
        status: 'PENDING',
        createdAt: new Date(),
      });
      mockTx.stationRecord.update.mockResolvedValue({});

      await BypassRequestService.create(workerId, orderId, 'IRONING', {
        items: [{ laundryItemId: 'item-1', quantity: 3 }], // mismatch
      });

      expect(mockTx.stationRecord.findUnique).toHaveBeenCalledTimes(2);
      expect(mockTx.stationRecord.findUnique).toHaveBeenNthCalledWith(2, {
        where: {
          orderId_station: { orderId, station: 'WASHING' },
        },
        include: { stationItems: true },
      });
    });
  });

  describe('getAll', () => {
    const makeBypass = (overrides = {}) => ({
      id: 'bp-1',
      stationRecord: {
        station: 'IRONING',
        order: { id: 'ord-1', outletId: 'outlet-1' },
      },
      worker: { user: { name: 'Bob Ironing' } },
      admin: null,
      status: 'PENDING',
      createdAt: new Date('2026-03-07T11:00:00.000Z'),
      resolvedAt: null,
      ...overrides,
    });

    it('SUPER_ADMIN: does not add outlet filter to where clause', async () => {
      (prisma.bypassRequest.findMany as jest.Mock).mockResolvedValue([makeBypass()]);
      (prisma.bypassRequest.count as jest.Mock).mockResolvedValue(1);

      await BypassRequestService.getAll('admin-1', 'SUPER_ADMIN', undefined, {
        page: 1,
        limit: 10,
      });

      const findManyCall = (prisma.bypassRequest.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where).not.toHaveProperty('stationRecord');
    });

    it('OUTLET_ADMIN with outletId: adds stationRecord.order.outletId filter', async () => {
      (prisma.bypassRequest.findMany as jest.Mock).mockResolvedValue([makeBypass()]);
      (prisma.bypassRequest.count as jest.Mock).mockResolvedValue(1);

      await BypassRequestService.getAll('admin-1', 'OUTLET_ADMIN', 'outlet-1', {
        page: 1,
        limit: 10,
      });

      const findManyCall = (prisma.bypassRequest.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where).toMatchObject({
        stationRecord: { order: { outletId: 'outlet-1' } },
      });
    });

    it('applies status filter when provided', async () => {
      (prisma.bypassRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.bypassRequest.count as jest.Mock).mockResolvedValue(0);

      await BypassRequestService.getAll('admin-1', 'SUPER_ADMIN', undefined, {
        page: 1,
        limit: 10,
        status: BypassStatus.PENDING,
      });

      const findManyCall = (prisma.bypassRequest.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where).toMatchObject({ status: 'PENDING' });
    });

    it('returns correct data and meta shape', async () => {
      const bypass = makeBypass();
      (prisma.bypassRequest.findMany as jest.Mock).mockResolvedValue([bypass]);
      (prisma.bypassRequest.count as jest.Mock).mockResolvedValue(1);

      const result = await BypassRequestService.getAll('admin-1', 'SUPER_ADMIN', undefined, {
        page: 1,
        limit: 10,
      });

      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'bp-1',
        orderId: 'ord-1',
        station: 'IRONING',
        workerName: 'Bob Ironing',
        status: 'PENDING',
        resolvedAt: null,
      });
    });

    it('orderBy respects the order param (asc)', async () => {
      (prisma.bypassRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.bypassRequest.count as jest.Mock).mockResolvedValue(0);

      await BypassRequestService.getAll('admin-1', 'SUPER_ADMIN', undefined, {
        page: 1,
        limit: 10,
        order: 'asc',
      });

      const findManyCall = (prisma.bypassRequest.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual({ createdAt: 'asc' });
    });

    it('orderBy defaults to desc when order param is omitted', async () => {
      (prisma.bypassRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.bypassRequest.count as jest.Mock).mockResolvedValue(0);

      await BypassRequestService.getAll('admin-1', 'SUPER_ADMIN', undefined, {
        page: 1,
        limit: 10,
      });

      const findManyCall = (prisma.bypassRequest.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual({ createdAt: 'desc' });
    });
  });
});
