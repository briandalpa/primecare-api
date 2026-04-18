jest.mock('@/application/database', () => ({
  prisma: {
    $transaction: jest.fn(),
    stationRecord: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    staff: {
      findFirst: jest.fn(),
    },
    orderItem: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/features/worker-notifications/worker-notification-service', () => ({
  WorkerNotificationService: {
    publishOrderArrival: jest.fn(),
  },
}));

import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import { WorkerNotificationService } from '@/features/worker-notifications/worker-notification-service';
import { WorkerOrderService } from '@/features/worker-orders/worker-order-service';

describe('WorkerOrderService', () => {
  const workerStaff = {
    id: 'staff-worker',
    userId: 'user-worker',
    role: 'WORKER',
    outletId: 'outlet-1',
    workerType: 'WASHING',
    isActive: true,
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws 422 when worker outlet or station is not configured', async () => {
    await expect(
      WorkerOrderService.getWorkerOrders(
        { ...workerStaff, outletId: null },
        { page: 1, limit: 10 },
      ),
    ).rejects.toThrow(
      new ResponseError(422, 'Worker station or outlet assignment is not configured'),
    );
  });

  it('returns paginated worker orders', async () => {
    (prisma.stationRecord.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'station-record-1',
        orderId: 'order-1',
        station: 'WASHING',
        status: 'IN_PROGRESS',
        createdAt: new Date('2026-04-17T08:00:00.000Z'),
        order: {
          updatedAt: new Date('2026-04-17T10:00:00.000Z'),
          outlet: { name: 'PrimeCare BSD' },
          pickupRequest: { customerUser: { name: 'John Doe' } },
          items: [{ quantity: 2 }, { quantity: 3 }],
        },
      },
    ]);
    (prisma.stationRecord.count as jest.Mock).mockResolvedValue(1);

    const result = await WorkerOrderService.getWorkerOrders(workerStaff, {
      page: 1,
      limit: 10,
      status: 'IN_PROGRESS',
      date: '2026-04-17',
    });

    expect(prisma.stationRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          station: 'WASHING',
          status: 'IN_PROGRESS',
          order: { outletId: 'outlet-1' },
        }),
        skip: 0,
        take: 10,
      }),
    );

    expect(result).toEqual({
      data: [
        {
          id: 'station-record-1',
          orderId: 'order-1',
          station: 'WASHING',
          status: 'IN_PROGRESS',
          totalItems: 5,
          updatedAt: new Date('2026-04-17T10:00:00.000Z'),
          createdAt: new Date('2026-04-17T08:00:00.000Z'),
          customerName: 'John Doe',
          outletName: 'PrimeCare BSD',
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it('applies date filter boundaries to createdAt', async () => {
    (prisma.stationRecord.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.stationRecord.count as jest.Mock).mockResolvedValue(0);

    await WorkerOrderService.getWorkerOrders(workerStaff, {
      page: 2,
      limit: 5,
      date: '2026-04-17',
    });

    expect(prisma.stationRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date('2026-04-17T00:00:00.000Z'),
            lte: new Date('2026-04-17T23:59:59.999Z'),
          },
        }),
        skip: 5,
        take: 5,
      }),
    );
  });

  it('returns paginated worker history', async () => {
    (prisma.stationRecord.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'station-record-history-1',
        orderId: 'order-history-1',
        station: 'WASHING',
        status: 'COMPLETED',
        createdAt: new Date('2026-04-17T08:00:00.000Z'),
        completedAt: new Date('2026-04-17T11:00:00.000Z'),
        order: {
          updatedAt: new Date('2026-04-17T10:00:00.000Z'),
          outlet: { name: 'PrimeCare BSD' },
          pickupRequest: { customerUser: { name: 'John Doe' } },
          items: [{ quantity: 2 }, { quantity: 3 }],
        },
      },
    ]);
    (prisma.stationRecord.count as jest.Mock).mockResolvedValue(1);

    const result = await WorkerOrderService.getWorkerHistory(workerStaff, {
      page: 1,
      limit: 10,
      station: 'WASHING',
      date: '2026-04-17',
    });

    expect(prisma.stationRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          staffId: 'staff-worker',
          status: 'COMPLETED',
          station: 'WASHING',
          order: { outletId: 'outlet-1' },
          completedAt: {
            gte: new Date('2026-04-17T00:00:00.000Z'),
            lte: new Date('2026-04-17T23:59:59.999Z'),
          },
        }),
        skip: 0,
        take: 10,
        orderBy: { completedAt: 'desc' },
      }),
    );

    expect(result).toEqual({
      data: [
        {
          id: 'station-record-history-1',
          orderId: 'order-history-1',
          station: 'WASHING',
          status: 'COMPLETED',
          totalItems: 5,
          updatedAt: new Date('2026-04-17T10:00:00.000Z'),
          createdAt: new Date('2026-04-17T08:00:00.000Z'),
          customerName: 'John Doe',
          outletName: 'PrimeCare BSD',
          completedAt: new Date('2026-04-17T11:00:00.000Z'),
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it('returns worker order detail with reference items for washing station', async () => {
    (prisma.stationRecord.findFirst as jest.Mock).mockResolvedValue({
      id: 'station-record-1',
      orderId: 'order-1',
      station: 'WASHING',
      status: 'IN_PROGRESS',
      createdAt: new Date('2026-04-17T08:00:00.000Z'),
      stationItems: [
        {
          laundryItemId: 'item-1',
          quantity: 4,
          laundryItem: { name: 'Shirt' },
        },
      ],
      order: {
        status: 'LAUNDRY_BEING_WASHED',
        paymentStatus: 'UNPAID',
        updatedAt: new Date('2026-04-17T10:00:00.000Z'),
        outlet: { name: 'PrimeCare BSD' },
        pickupRequest: { customerUser: { name: 'John Doe' } },
        items: [{ quantity: 2 }, { quantity: 3 }],
      },
    });
    (prisma.orderItem.findMany as jest.Mock).mockResolvedValue([
      {
        laundryItemId: 'item-1',
        quantity: 5,
        laundryItem: { name: 'Shirt' },
      },
    ]);

    const result = await WorkerOrderService.getWorkerOrderDetail(
      workerStaff,
      'order-1',
    );

    expect(prisma.stationRecord.findFirst).toHaveBeenCalledWith({
      where: {
        orderId: 'order-1',
        station: 'WASHING',
        order: { outletId: 'outlet-1' },
      },
      include: {
        stationItems: {
          include: {
            laundryItem: {
              select: { name: true },
            },
          },
        },
        order: {
          include: {
            outlet: true,
            pickupRequest: {
              include: {
                customerUser: {
                  select: { name: true },
                },
              },
            },
            items: true,
          },
        },
      },
    });
    expect(result).toEqual({
      orderId: 'order-1',
      stationRecordId: 'station-record-1',
      station: 'WASHING',
      previousStation: null,
      stationStatus: 'IN_PROGRESS',
      orderStatus: 'LAUNDRY_BEING_WASHED',
      paymentStatus: 'UNPAID',
      totalItems: 5,
      customerName: 'John Doe',
      outletName: 'PrimeCare BSD',
      createdAt: new Date('2026-04-17T08:00:00.000Z'),
      updatedAt: new Date('2026-04-17T10:00:00.000Z'),
      referenceItems: [
        {
          laundryItemId: 'item-1',
          itemName: 'Shirt',
          quantity: 5,
        },
      ],
      stationItems: [
        {
          laundryItemId: 'item-1',
          itemName: 'Shirt',
          quantity: 4,
        },
      ],
    });
  });

  it('throws 404 when worker order detail is not found', async () => {
    (prisma.stationRecord.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      WorkerOrderService.getWorkerOrderDetail(workerStaff, 'order-404'),
    ).rejects.toThrow(new ResponseError(404, 'Worker order not found'));
  });

  it('throws 400 when submitted quantities do not match the reference items', async () => {
    const mockTx = {
      stationRecord: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'station-record-1',
          orderId: 'order-1',
          station: 'WASHING',
          staffId: 'staff-worker',
          status: 'IN_PROGRESS',
          order: {
            id: 'order-1',
            status: 'LAUNDRY_BEING_WASHED',
            paymentStatus: 'UNPAID',
            outletId: 'outlet-1',
          },
          stationItems: [],
        }),
      },
      orderItem: {
        findMany: jest.fn().mockResolvedValue([
          { laundryItemId: 'item-1', quantity: 5 },
        ]),
      },
      stationItem: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      order: {
        update: jest.fn(),
      },
      delivery: {
        create: jest.fn(),
      },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback(mockTx),
    );

    await expect(
      WorkerOrderService.processWorkerOrder(workerStaff, 'order-1', {
        items: [{ laundryItemId: 'item-1', quantity: 3 }],
      }),
    ).rejects.toThrow(new ResponseError(400, 'Quantity mismatch detected'));
    expect(mockTx.stationItem.deleteMany).not.toHaveBeenCalled();
  });

  it('processes a washing order and advances it to ironing', async () => {
    const completedAt = new Date('2026-04-18T02:00:00.000Z');
    const mockTx = {
      stationRecord: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'station-record-1',
          orderId: 'order-1',
          station: 'WASHING',
          staffId: 'staff-worker',
          status: 'IN_PROGRESS',
          order: {
            id: 'order-1',
            status: 'LAUNDRY_BEING_WASHED',
            paymentStatus: 'UNPAID',
            outletId: 'outlet-1',
          },
          stationItems: [],
        }),
        update: jest.fn().mockResolvedValue({
          id: 'station-record-1',
          orderId: 'order-1',
          station: 'WASHING',
          status: 'COMPLETED',
          completedAt,
        }),
        create: jest.fn().mockResolvedValue({
          id: 'station-record-2',
        }),
      },
      orderItem: {
        findMany: jest.fn().mockResolvedValue([
          { laundryItemId: 'item-1', quantity: 5 },
        ]),
      },
      stationItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        update: jest.fn().mockResolvedValue({}),
      },
      delivery: {
        create: jest.fn(),
      },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback(mockTx),
    );
    (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
      id: 'staff-ironing',
    });

    const result = await WorkerOrderService.processWorkerOrder(
      workerStaff,
      'order-1',
      {
        items: [{ laundryItemId: 'item-1', quantity: 5 }],
      },
    );

    expect(mockTx.stationItem.deleteMany).toHaveBeenCalledWith({
      where: { stationRecordId: 'station-record-1' },
    });
    expect(mockTx.stationItem.createMany).toHaveBeenCalledWith({
      data: [
        {
          stationRecordId: 'station-record-1',
          laundryItemId: 'item-1',
          quantity: 5,
        },
      ],
    });
    expect(mockTx.stationRecord.update).toHaveBeenCalledWith({
      where: { id: 'station-record-1' },
      data: {
        status: 'COMPLETED',
        completedAt: expect.any(Date),
      },
    });
    expect(mockTx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'LAUNDRY_BEING_IRONED' },
    });
    expect(prisma.staff.findFirst).toHaveBeenCalledWith({
      where: {
        role: 'WORKER',
        isActive: true,
        outletId: 'outlet-1',
        workerType: 'IRONING',
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(mockTx.stationRecord.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        station: 'IRONING',
        staffId: 'staff-ironing',
        status: 'IN_PROGRESS',
      },
    });
    expect(WorkerNotificationService.publishOrderArrival).toHaveBeenCalledWith({
      orderId: 'order-1',
      outletId: 'outlet-1',
      orderStatus: 'LAUNDRY_BEING_IRONED',
    });
    expect(result).toEqual({
      orderId: 'order-1',
      stationRecordId: 'station-record-1',
      station: 'WASHING',
      stationStatus: 'COMPLETED',
      orderStatus: 'LAUNDRY_BEING_IRONED',
      completedAt,
    });
  });

  it('completes packing and moves unpaid orders to waiting for payment', async () => {
    const completedAt = new Date('2026-04-18T03:00:00.000Z');
    const packingWorker = { ...workerStaff, workerType: 'PACKING' };
    const mockTx = {
      stationRecord: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'station-record-3',
            orderId: 'order-2',
            station: 'PACKING',
            staffId: 'staff-worker',
            status: 'IN_PROGRESS',
            order: {
              id: 'order-2',
              status: 'LAUNDRY_BEING_PACKED',
              paymentStatus: 'UNPAID',
              outletId: 'outlet-1',
            },
            stationItems: [],
          })
          .mockResolvedValueOnce({
            id: 'station-record-2',
            station: 'IRONING',
            stationItems: [{ laundryItemId: 'item-1', quantity: 2 }],
          }),
        update: jest.fn().mockResolvedValue({
          id: 'station-record-3',
          orderId: 'order-2',
          station: 'PACKING',
          status: 'COMPLETED',
          completedAt,
        }),
        create: jest.fn(),
      },
      orderItem: {
        findMany: jest.fn(),
      },
      stationItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        update: jest.fn().mockResolvedValue({}),
      },
      delivery: {
        create: jest.fn(),
      },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback(mockTx),
    );

    const result = await WorkerOrderService.processWorkerOrder(
      packingWorker,
      'order-2',
      {
        items: [{ laundryItemId: 'item-1', quantity: 2 }],
      },
    );

    expect(mockTx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-2' },
      data: { status: 'WAITING_FOR_PAYMENT' },
    });
    expect(mockTx.delivery.create).not.toHaveBeenCalled();
    expect(prisma.staff.findFirst).not.toHaveBeenCalled();
    expect(mockTx.stationRecord.create).not.toHaveBeenCalled();
    expect(WorkerNotificationService.publishOrderArrival).toHaveBeenCalledWith({
      orderId: 'order-2',
      outletId: 'outlet-1',
      orderStatus: 'WAITING_FOR_PAYMENT',
    });
    expect(result).toEqual({
      orderId: 'order-2',
      stationRecordId: 'station-record-3',
      station: 'PACKING',
      stationStatus: 'COMPLETED',
      orderStatus: 'WAITING_FOR_PAYMENT',
      completedAt,
    });
  });

  it('completes packing and creates delivery when the order is already paid', async () => {
    const completedAt = new Date('2026-04-18T04:00:00.000Z');
    const packingWorker = { ...workerStaff, workerType: 'PACKING' };
    const mockTx = {
      stationRecord: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'station-record-4',
            orderId: 'order-3',
            station: 'PACKING',
            staffId: 'staff-worker',
            status: 'IN_PROGRESS',
            order: {
              id: 'order-3',
              status: 'LAUNDRY_BEING_PACKED',
              paymentStatus: 'PAID',
              outletId: 'outlet-1',
            },
            stationItems: [],
          })
          .mockResolvedValueOnce({
            id: 'station-record-2',
            station: 'IRONING',
            stationItems: [{ laundryItemId: 'item-1', quantity: 4 }],
          }),
        update: jest.fn().mockResolvedValue({
          id: 'station-record-4',
          orderId: 'order-3',
          station: 'PACKING',
          status: 'COMPLETED',
          completedAt,
        }),
        create: jest.fn(),
      },
      orderItem: {
        findMany: jest.fn(),
      },
      stationItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        update: jest.fn().mockResolvedValue({}),
      },
      delivery: {
        create: jest.fn().mockResolvedValue({ id: 'delivery-1' }),
      },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback(mockTx),
    );

    const result = await WorkerOrderService.processWorkerOrder(
      packingWorker,
      'order-3',
      {
        items: [{ laundryItemId: 'item-1', quantity: 4 }],
      },
    );

    expect(mockTx.delivery.create).toHaveBeenCalledWith({
      data: { orderId: 'order-3' },
    });
    expect(mockTx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-3' },
      data: { status: 'LAUNDRY_READY_FOR_DELIVERY' },
    });
    expect(prisma.staff.findFirst).not.toHaveBeenCalled();
    expect(mockTx.stationRecord.create).not.toHaveBeenCalled();
    expect(WorkerNotificationService.publishOrderArrival).toHaveBeenCalledWith({
      orderId: 'order-3',
      outletId: 'outlet-1',
      orderStatus: 'LAUNDRY_READY_FOR_DELIVERY',
    });
    expect(result).toEqual({
      orderId: 'order-3',
      stationRecordId: 'station-record-4',
      station: 'PACKING',
      stationStatus: 'COMPLETED',
      orderStatus: 'LAUNDRY_READY_FOR_DELIVERY',
      completedAt,
    });
  });
});
