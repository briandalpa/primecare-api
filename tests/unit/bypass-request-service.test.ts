jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

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
    createMany: jest.fn(),
  },
  bypassRequest: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  account: {
    findFirst: jest.fn(),
  },
  order: {
    update: jest.fn(),
  },
  delivery: {
    create: jest.fn(),
  },
};

jest.mock('@/application/database', () => ({
  prisma: {
    $transaction: jest.fn((callback: (tx: typeof mockTx) => Promise<any>) => callback(mockTx)),
    bypassRequest: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    orderItem: {
      findMany: jest.fn(),
    },
    stationRecord: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/features/worker-notifications/worker-notification-service', () => ({
  WorkerNotificationService: {
    publishOrderArrival: jest.fn(),
  },
}));

import { BypassRequestService } from '@/features/bypass-requests/bypass-request-service';
import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import bcrypt from 'bcrypt';
import { WorkerNotificationService } from '@/features/worker-notifications/worker-notification-service';

describe('BypassRequestService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(
      (callback: (tx: typeof mockTx) => Promise<any>) => callback(mockTx)
    );
    (prisma.bypassRequest.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.bypassRequest.count as jest.Mock).mockResolvedValue(0);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
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
      const notes = 'The item count changed after manual recount.';
      const createdBypass = {
        id: 'bp-1',
        stationRecordId,
        workerId,
        adminId: null,
        problemDescription: notes,
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
      mockTx.stationItem.createMany.mockResolvedValue({ count: 1 });
      mockTx.bypassRequest.create.mockResolvedValue(createdBypass);
      mockTx.stationRecord.update.mockResolvedValue({
        id: stationRecordId,
        status: 'BYPASS_REQUESTED',
      });

      const result = await BypassRequestService.create(workerId, orderId, 'WASHING', {
        items: [{ laundryItemId: 'item-1', quantity: 3 }], // mismatch
        notes,
      });

      expect(mockTx.stationItem.deleteMany).toHaveBeenCalledWith({
        where: { stationRecordId },
      });

      expect(mockTx.stationItem.createMany).toHaveBeenCalledWith({
        data: [{ stationRecordId, laundryItemId: 'item-1', quantity: 3 }],
      });

      expect(mockTx.bypassRequest.create).toHaveBeenCalledWith({
        data: {
          stationRecordId,
          workerId,
          adminId: null,
          status: 'PENDING',
          problemDescription: notes,
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
      mockTx.stationItem.createMany.mockResolvedValue({ count: 1 });
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

    it('uses correct reference source for PACKING station', async () => {
      mockTx.stationRecord.findUnique
        .mockResolvedValueOnce({
          id: stationRecordId,
          orderId,
          station: 'PACKING',
          staffId: workerId,
          status: 'IN_PROGRESS',
          stationItems: [],
        })
        .mockResolvedValueOnce({
          id: 'sr-ironing',
          orderId,
          station: 'IRONING',
          stationItems: [{ laundryItemId: 'item-1', quantity: 5 }],
        });

      mockTx.bypassRequest.findFirst.mockResolvedValue(null);
      mockTx.stationItem.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.stationItem.createMany.mockResolvedValue({ count: 1 });
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

      await BypassRequestService.create(workerId, orderId, 'PACKING', {
        items: [{ laundryItemId: 'item-1', quantity: 3 }], // mismatch
      });

      expect(mockTx.stationRecord.findUnique).toHaveBeenCalledTimes(2);
      expect(mockTx.stationRecord.findUnique).toHaveBeenNthCalledWith(2, {
        where: {
          orderId_station: { orderId, station: 'IRONING' },
        },
        include: { stationItems: true },
      });
    });

    it('throws 422 when previous station record not found', async () => {
      mockTx.stationRecord.findUnique
        .mockResolvedValueOnce({
          id: stationRecordId,
          orderId,
          station: 'IRONING',
          staffId: workerId,
          status: 'IN_PROGRESS',
          stationItems: [],
        })
        .mockResolvedValueOnce(null); // prev station missing

      await expect(
        BypassRequestService.create(workerId, orderId, 'IRONING', {
          items: [{ laundryItemId: 'item-1', quantity: 3 }],
        })
      ).rejects.toThrow(
        new ResponseError(422, 'Previous station has no completed records. Cannot proceed.')
      );
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

      await BypassRequestService.getAll('SUPER_ADMIN', undefined, {
        page: 1,
        limit: 10,
      });

      const findManyCall = (prisma.bypassRequest.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where).not.toHaveProperty('stationRecord');
    });

    it('OUTLET_ADMIN with outletId: adds stationRecord.order.outletId filter', async () => {
      (prisma.bypassRequest.findMany as jest.Mock).mockResolvedValue([makeBypass()]);
      (prisma.bypassRequest.count as jest.Mock).mockResolvedValue(1);

      await BypassRequestService.getAll('OUTLET_ADMIN', 'outlet-1', {
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

      await BypassRequestService.getAll('SUPER_ADMIN', undefined, {
        page: 1,
        limit: 10,
        status: 'PENDING',
      });

      const findManyCall = (prisma.bypassRequest.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where).toMatchObject({ status: 'PENDING' });
    });

    it('returns correct data and meta shape', async () => {
      const bypass = makeBypass();
      (prisma.bypassRequest.findMany as jest.Mock).mockResolvedValue([bypass]);
      (prisma.bypassRequest.count as jest.Mock).mockResolvedValue(1);

      const result = await BypassRequestService.getAll('SUPER_ADMIN', undefined, {
        page: 1,
        limit: 10,
      });

      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
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

      await BypassRequestService.getAll('SUPER_ADMIN', undefined, {
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

      await BypassRequestService.getAll('SUPER_ADMIN', undefined, {
        page: 1,
        limit: 10,
      });

      const findManyCall = (prisma.bypassRequest.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual({ createdAt: 'desc' });
    });
  });

  describe('approve', () => {
    const adminStaffId = 'staff-admin';
    const adminUserId = 'user-admin';
    const bypassId = 'bp-1';
    const password = 'correct-password';
    const problemDescription = 'One item was damaged.';

    const makeBypass = (status = 'PENDING', paymentStatus = 'UNPAID', orderStatus = 'LAUNDRY_BEING_WASHED') => ({
      id: bypassId,
      stationRecordId: 'sr-1',
      status,
      stationRecord: {
        order: { id: 'ord-1', status: orderStatus, paymentStatus, outletId: 'outlet-1' },
      },
    });

    const approve = (overrides: { role?: string; outletId?: string } = {}) =>
      BypassRequestService.approve(
        {
          staffId: adminStaffId,
          userId: adminUserId,
          role: overrides.role ?? 'OUTLET_ADMIN',
          outletId: overrides.outletId ?? 'outlet-1',
        },
        bypassId,
        password,
        problemDescription
      );

    beforeEach(() => {
      mockTx.account.findFirst.mockResolvedValue({ password: 'hashed-password' });
    });

    it('throws 401 when password is incorrect', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(approve()).rejects.toThrow(new ResponseError(401, 'Incorrect password'));
    });

    it('throws 401 when credential account not found', async () => {
      mockTx.account.findFirst.mockResolvedValue(null);
      await expect(approve()).rejects.toThrow(new ResponseError(401, 'Incorrect password'));
    });

    it('throws 404 when bypass not found', async () => {
      mockTx.bypassRequest.findUnique.mockResolvedValue(null);
      await expect(approve()).rejects.toThrow(new ResponseError(404, 'Bypass request not found'));
    });

    it('throws 409 when bypass is not PENDING', async () => {
      mockTx.bypassRequest.findUnique.mockResolvedValue(makeBypass('APPROVED'));
      await expect(approve()).rejects.toThrow(new ResponseError(409, 'Bypass request is not in PENDING state'));
    });

    it('throws 403 when OUTLET_ADMIN accesses a bypass from another outlet', async () => {
      mockTx.bypassRequest.findUnique.mockResolvedValue(makeBypass('PENDING', 'UNPAID', 'LAUNDRY_BEING_WASHED'));
      await expect(approve({ outletId: 'outlet-other' })).rejects.toThrow(new ResponseError(403, 'Access denied'));
    });

    it('advances WASHING order to LAUNDRY_BEING_IRONED', async () => {
      const resolvedAt = new Date();
      mockTx.bypassRequest.findUnique.mockResolvedValue(makeBypass('PENDING', 'UNPAID', 'LAUNDRY_BEING_WASHED'));
      mockTx.bypassRequest.update.mockResolvedValue({
        id: bypassId, status: 'APPROVED', adminId: adminStaffId, problemDescription, resolvedAt,
      });
      mockTx.stationRecord.update.mockResolvedValue({});
      mockTx.order.update.mockResolvedValue({});

      const result = await approve();

      expect(mockTx.order.update).toHaveBeenCalledWith({ where: { id: 'ord-1' }, data: { status: 'LAUNDRY_BEING_IRONED' } });
      expect(WorkerNotificationService.publishOrderArrival).toHaveBeenCalledWith({
        orderId: 'ord-1',
        outletId: 'outlet-1',
        orderStatus: 'LAUNDRY_BEING_IRONED',
      });
      expect(result.orderStatus).toBe('LAUNDRY_BEING_IRONED');
    });

    it('advances IRONING order to LAUNDRY_BEING_PACKED', async () => {
      mockTx.bypassRequest.findUnique.mockResolvedValue(makeBypass('PENDING', 'UNPAID', 'LAUNDRY_BEING_IRONED'));
      mockTx.bypassRequest.update.mockResolvedValue({
        id: bypassId, status: 'APPROVED', adminId: adminStaffId, problemDescription, resolvedAt: new Date(),
      });
      mockTx.stationRecord.update.mockResolvedValue({});
      mockTx.order.update.mockResolvedValue({});

      const result = await approve();

      expect(mockTx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'LAUNDRY_BEING_PACKED' } }));
      expect(WorkerNotificationService.publishOrderArrival).toHaveBeenCalledWith({
        orderId: 'ord-1',
        outletId: 'outlet-1',
        orderStatus: 'LAUNDRY_BEING_PACKED',
      });
      expect(result.orderStatus).toBe('LAUNDRY_BEING_PACKED');
    });

    it('forks PACKING to WAITING_FOR_PAYMENT when order is UNPAID', async () => {
      mockTx.bypassRequest.findUnique.mockResolvedValue(makeBypass('PENDING', 'UNPAID', 'LAUNDRY_BEING_PACKED'));
      mockTx.bypassRequest.update.mockResolvedValue({
        id: bypassId, status: 'APPROVED', adminId: adminStaffId, problemDescription, resolvedAt: new Date(),
      });
      mockTx.stationRecord.update.mockResolvedValue({});
      mockTx.order.update.mockResolvedValue({});

      const result = await approve();

      expect(result.orderStatus).toBe('WAITING_FOR_PAYMENT');
      expect(WorkerNotificationService.publishOrderArrival).toHaveBeenCalledWith({
        orderId: 'ord-1',
        outletId: 'outlet-1',
        orderStatus: 'WAITING_FOR_PAYMENT',
      });
      expect(mockTx.delivery.create).not.toHaveBeenCalled();
    });

    it('forks PACKING to LAUNDRY_READY_FOR_DELIVERY and creates Delivery when PAID', async () => {
      mockTx.bypassRequest.findUnique.mockResolvedValue(makeBypass('PENDING', 'PAID', 'LAUNDRY_BEING_PACKED'));
      mockTx.bypassRequest.update.mockResolvedValue({
        id: bypassId, status: 'APPROVED', adminId: adminStaffId, problemDescription, resolvedAt: new Date(),
      });
      mockTx.stationRecord.update.mockResolvedValue({});
      mockTx.order.update.mockResolvedValue({});
      mockTx.delivery.create.mockResolvedValue({ id: 'del-1', orderId: 'ord-1' });

      const result = await approve();

      expect(result.orderStatus).toBe('LAUNDRY_READY_FOR_DELIVERY');
      expect(WorkerNotificationService.publishOrderArrival).toHaveBeenCalledWith({
        orderId: 'ord-1',
        outletId: 'outlet-1',
        orderStatus: 'LAUNDRY_READY_FOR_DELIVERY',
      });
      expect(mockTx.delivery.create).toHaveBeenCalledWith({ data: { orderId: 'ord-1' } });
    });
  });

  describe('reject', () => {
    const adminStaffId = 'staff-admin';
    const adminUserId = 'user-admin';
    const bypassId = 'bp-1';

    const makePendingBypass = () => ({
      id: bypassId,
      stationRecordId: 'sr-1',
      status: 'PENDING',
      stationRecord: { order: { id: 'ord-1', status: 'LAUNDRY_BEING_WASHED', paymentStatus: 'UNPAID', outletId: 'outlet-1' } },
    });

    const reject = (overrides: { outletId?: string; password?: string } = {}) =>
      BypassRequestService.reject(
        {
          staffId: adminStaffId,
          userId: adminUserId,
          role: 'OUTLET_ADMIN',
          outletId: overrides.outletId ?? 'outlet-1',
        },
        bypassId,
        overrides.password ?? 'password'
      );

    beforeEach(() => {
      mockTx.account.findFirst.mockResolvedValue({ password: 'hashed-password' });
    });

    it('throws 401 when password is incorrect', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(reject()).rejects.toThrow(new ResponseError(401, 'Incorrect password'));
    });

    it('throws 401 when credential account not found', async () => {
      mockTx.account.findFirst.mockResolvedValue(null);
      await expect(reject()).rejects.toThrow(new ResponseError(401, 'Incorrect password'));
    });

    it('throws 404 when bypass not found', async () => {
      mockTx.bypassRequest.findUnique.mockResolvedValue(null);
      await expect(reject()).rejects.toThrow(new ResponseError(404, 'Bypass request not found'));
    });

    it('throws 409 when bypass is already processed', async () => {
      mockTx.bypassRequest.findUnique.mockResolvedValue({ ...makePendingBypass(), status: 'APPROVED' });
      await expect(reject()).rejects.toThrow(new ResponseError(409, 'Bypass request is not in PENDING state'));
    });

    it('throws 403 when OUTLET_ADMIN accesses a bypass from another outlet', async () => {
      mockTx.bypassRequest.findUnique.mockResolvedValue(makePendingBypass());
      await expect(reject({ outletId: 'outlet-other' })).rejects.toThrow(new ResponseError(403, 'Access denied'));
    });

    it('sets status to REJECTED and reverts stationRecord to IN_PROGRESS', async () => {
      const resolvedAt = new Date();
      mockTx.bypassRequest.findUnique.mockResolvedValue(makePendingBypass());
      mockTx.bypassRequest.update.mockResolvedValue({
        id: bypassId, status: 'REJECTED', adminId: adminStaffId, resolvedAt,
      });
      mockTx.stationRecord.update.mockResolvedValue({});

      await reject();

      expect(mockTx.stationRecord.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: { status: 'IN_PROGRESS' },
      });
    });
  });

  describe('getById', () => {
    const bypassId = 'bp-1';

    const makeDetailBypass = (outletId = 'outlet-1') => ({
      id: bypassId,
      stationRecordId: 'sr-1',
      workerId: 'staff-worker',
      adminId: null,
      problemDescription: null,
      status: 'PENDING',
      createdAt: new Date(),
      resolvedAt: null,
      stationRecord: {
        station: 'WASHING',
        orderId: 'ord-1',
        order: { id: 'ord-1', outletId },
        stationItems: [
          { laundryItemId: 'item-1', quantity: 3, laundryItem: { name: 'T-Shirt' } },
        ],
      },
      worker: { user: { name: 'Worker Bob' } },
      admin: null,
    });

    it('throws 404 when bypass not found', async () => {
      (prisma.bypassRequest.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        BypassRequestService.getById('OUTLET_ADMIN', 'outlet-1', bypassId)
      ).rejects.toThrow(new ResponseError(404, 'Bypass request not found'));
    });

    it('throws 403 for OUTLET_ADMIN accessing wrong outlet', async () => {
      (prisma.bypassRequest.findUnique as jest.Mock).mockResolvedValue(makeDetailBypass('outlet-other'));

      await expect(
        BypassRequestService.getById('OUTLET_ADMIN', 'outlet-1', bypassId)
      ).rejects.toThrow(new ResponseError(403, 'Access denied'));
    });

    it('returns detail with referenceItems from OrderItems for WASHING station', async () => {
      (prisma.bypassRequest.findUnique as jest.Mock).mockResolvedValue(makeDetailBypass());
      (prisma.orderItem.findMany as jest.Mock).mockResolvedValue([
        { laundryItemId: 'item-1', quantity: 5, laundryItem: { name: 'T-Shirt' } },
      ]);

      const result = await BypassRequestService.getById('OUTLET_ADMIN', 'outlet-1', bypassId);

      expect(result.referenceItems).toEqual([
        { laundryItemId: 'item-1', itemName: 'T-Shirt', quantity: 5 },
      ]);
      expect(result.workerItems).toEqual([
        { laundryItemId: 'item-1', itemName: 'T-Shirt', quantity: 3 },
      ]);
    });

    it('returns detail with referenceItems from previous station for IRONING', async () => {
      const ironingBypass = {
        ...makeDetailBypass(),
        stationRecord: {
          ...makeDetailBypass().stationRecord,
          station: 'IRONING',
          stationItems: [
            { laundryItemId: 'item-1', quantity: 2, laundryItem: { name: 'T-Shirt' } },
          ],
        },
      };
      (prisma.bypassRequest.findUnique as jest.Mock).mockResolvedValue(ironingBypass);
      (prisma.stationRecord.findUnique as jest.Mock).mockResolvedValue({
        stationItems: [
          { laundryItemId: 'item-1', quantity: 5, laundryItem: { name: 'T-Shirt' } },
        ],
      });

      const result = await BypassRequestService.getById('OUTLET_ADMIN', 'outlet-1', bypassId);

      expect(result.referenceItems).toEqual([
        { laundryItemId: 'item-1', itemName: 'T-Shirt', quantity: 5 },
      ]);
    });

    it('returns detail with referenceItems from IRONING station for PACKING', async () => {
      const packingBypass = {
        ...makeDetailBypass(),
        stationRecord: {
          ...makeDetailBypass().stationRecord,
          station: 'PACKING',
          stationItems: [
            { laundryItemId: 'item-1', quantity: 2, laundryItem: { name: 'T-Shirt' } },
          ],
        },
      };
      (prisma.bypassRequest.findUnique as jest.Mock).mockResolvedValue(packingBypass);
      (prisma.stationRecord.findUnique as jest.Mock).mockResolvedValue({
        stationItems: [
          { laundryItemId: 'item-1', quantity: 4, laundryItem: { name: 'T-Shirt' } },
        ],
      });

      const result = await BypassRequestService.getById('OUTLET_ADMIN', 'outlet-1', bypassId);

      expect(prisma.stationRecord.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderId_station: { orderId: 'ord-1', station: 'IRONING' } },
        })
      );
      expect(result.referenceItems).toEqual([
        { laundryItemId: 'item-1', itemName: 'T-Shirt', quantity: 4 },
      ]);
    });
  });
});
