jest.mock('@/application/database', () => ({
  prisma: {
    stationRecord: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    orderItem: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
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
});
