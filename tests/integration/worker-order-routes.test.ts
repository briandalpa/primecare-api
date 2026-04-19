jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn(
    (headers: Record<string, string | string[] | undefined>) => headers,
  ),
  toNodeHandler: jest.fn(() => (_req: any, res: any) => res.json({ ok: true })),
}));

jest.mock('@/application/database', () => ({
  prisma: {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn() },
    staff: { findUnique: jest.fn(), findFirst: jest.fn() },
    stationRecord: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
    orderItem: { findMany: jest.fn() },
  },
}));

jest.mock('@/utils/auth', () => ({
  auth: {
    api: { getSession: jest.fn() },
  },
}));

jest.mock('@/features/worker-notifications/worker-notification-service', () => ({
  WorkerNotificationService: {
    publishOrderArrival: jest.fn(),
  },
}));

import request from 'supertest';
import { app } from '@/application/app';
import { prisma } from '@/application/database';
import { auth } from '@/utils/auth';

describe('Worker Order Routes', () => {
  const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockWorkerAuth = (overrides: Partial<any> = {}) => {
    const mockUser = { id: 'user-worker', email: 'worker@example.com' };
    const mockStaff = {
      id: 'staff-worker',
      userId: 'user-worker',
      role: 'WORKER',
      isActive: true,
      outletId: 'outlet-1',
      workerType: 'WASHING',
      ...overrides,
    };

    (auth.api.getSession as jest.Mock).mockResolvedValue({
      user: mockUser,
      session: { id: 'session-1', expiresAt: new Date() },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
  };

  it('returns 401 when unauthenticated', async () => {
    (auth.api.getSession as jest.Mock).mockResolvedValue(null);

    const response = await request(app).get('/api/v1/worker/orders');

    expect(response.status).toBe(401);
  });

  it('returns 403 for non-worker roles', async () => {
    mockWorkerAuth({ role: 'OUTLET_ADMIN' });

    const response = await request(app).get('/api/v1/worker/orders');

    expect(response.status).toBe(403);
  });

  it('returns 400 for invalid query params', async () => {
    mockWorkerAuth();

    const response = await request(app)
      .get('/api/v1/worker/orders')
      .query({ page: 0, status: 'INVALID_STATUS' });

    expect(response.status).toBe(400);
  });

  it('returns 422 when worker station or outlet is not configured', async () => {
    mockWorkerAuth({ workerType: null });

    const response = await request(app).get('/api/v1/worker/orders');

    expect(response.status).toBe(422);
    expect(response.body.errors).toBe(
      'Worker station or outlet assignment is not configured',
    );
  });

  it('returns paginated worker orders with standard envelope', async () => {
    mockWorkerAuth();
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

    const response = await request(app)
      .get('/api/v1/worker/orders')
      .query({ page: 1, limit: 10, status: 'IN_PROGRESS', date: '2026-04-17' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'success',
      message: 'Worker orders retrieved',
      data: [
        {
          id: 'station-record-1',
          orderId: 'order-1',
          station: 'WASHING',
          status: 'IN_PROGRESS',
          totalItems: 5,
          updatedAt: '2026-04-17T10:00:00.000Z',
          createdAt: '2026-04-17T08:00:00.000Z',
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

  it('returns 400 for invalid worker order id param', async () => {
    mockWorkerAuth();

    const response = await request(app).get('/api/v1/worker/orders/not-a-uuid');

    expect(response.status).toBe(400);
  });

  it('returns 404 when worker order detail is not found', async () => {
    mockWorkerAuth();
    (prisma.stationRecord.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await request(app).get(
      '/api/v1/worker/orders/123e4567-e89b-12d3-a456-426614174000',
    );

    expect(response.status).toBe(404);
    expect(response.body.errors).toBe('Worker order not found');
  });

  it('returns worker order detail with comparison items', async () => {
    mockWorkerAuth();
    (prisma.stationRecord.findFirst as jest.Mock).mockResolvedValue({
      id: 'station-record-1',
      orderId: '123e4567-e89b-12d3-a456-426614174000',
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

    const response = await request(app).get(
      '/api/v1/worker/orders/123e4567-e89b-12d3-a456-426614174000',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'success',
      message: 'Worker order retrieved',
      data: {
        orderId: '123e4567-e89b-12d3-a456-426614174000',
        stationRecordId: 'station-record-1',
        station: 'WASHING',
        previousStation: null,
        stationStatus: 'IN_PROGRESS',
        orderStatus: 'LAUNDRY_BEING_WASHED',
        paymentStatus: 'UNPAID',
        totalItems: 5,
        customerName: 'John Doe',
        outletName: 'PrimeCare BSD',
        createdAt: '2026-04-17T08:00:00.000Z',
        updatedAt: '2026-04-17T10:00:00.000Z',
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
      },
    });
  });

  it('returns 400 for invalid process payload', async () => {
    mockWorkerAuth();

    const response = await request(app)
      .post('/api/v1/worker/orders/123e4567-e89b-12d3-a456-426614174000/process')
      .send({ items: [] });

    expect(response.status).toBe(400);
  });

  it('returns 400 when submitted quantities do not match reference items', async () => {
    mockWorkerAuth();
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
      order: { update: jest.fn() },
      delivery: { create: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback(mockTx),
    );

    const response = await request(app)
      .post('/api/v1/worker/orders/123e4567-e89b-12d3-a456-426614174000/process')
      .send({
        items: [{ laundryItemId: VALID_UUID, quantity: 3 }],
      });

    expect(response.status).toBe(400);
    expect(response.body.errors).toBe('Quantity mismatch detected');
  });

  it('processes a worker order and advances it to the next station', async () => {
    mockWorkerAuth();
    const completedAt = new Date('2026-04-18T02:00:00.000Z');
    const mockTx = {
      stationRecord: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'station-record-1',
          orderId: '123e4567-e89b-12d3-a456-426614174000',
          station: 'WASHING',
          staffId: 'staff-worker',
          status: 'IN_PROGRESS',
          order: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            status: 'LAUNDRY_BEING_WASHED',
            paymentStatus: 'UNPAID',
            outletId: 'outlet-1',
          },
          stationItems: [],
        }),
        update: jest.fn().mockResolvedValue({
          id: 'station-record-1',
          orderId: '123e4567-e89b-12d3-a456-426614174000',
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
          { laundryItemId: VALID_UUID, quantity: 5 },
        ]),
      },
      stationItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        update: jest.fn().mockResolvedValue({}),
      },
      delivery: { create: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback(mockTx),
    );
    (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
      id: 'staff-ironing',
    });

    const response = await request(app)
      .post('/api/v1/worker/orders/123e4567-e89b-12d3-a456-426614174000/process')
      .send({
        items: [{ laundryItemId: VALID_UUID, quantity: 5 }],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'success',
      message: 'Worker order processed successfully',
      data: {
        orderId: '123e4567-e89b-12d3-a456-426614174000',
        stationRecordId: 'station-record-1',
        station: 'WASHING',
        stationStatus: 'COMPLETED',
        orderStatus: 'LAUNDRY_BEING_IRONED',
        completedAt: '2026-04-18T02:00:00.000Z',
      },
    });
  });

  it('completes packing for unpaid orders and moves them to waiting for payment', async () => {
    mockWorkerAuth({ workerType: 'PACKING' });
    const completedAt = new Date('2026-04-18T03:00:00.000Z');
    const mockTx = {
      stationRecord: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'station-record-3',
            orderId: '123e4567-e89b-12d3-a456-426614174000',
            station: 'PACKING',
            staffId: 'staff-worker',
            status: 'IN_PROGRESS',
            order: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              status: 'LAUNDRY_BEING_PACKED',
              paymentStatus: 'UNPAID',
              outletId: 'outlet-1',
            },
            stationItems: [],
          })
          .mockResolvedValueOnce({
            id: 'station-record-2',
            station: 'IRONING',
            stationItems: [{ laundryItemId: VALID_UUID, quantity: 2 }],
          }),
        update: jest.fn().mockResolvedValue({
          id: 'station-record-3',
          orderId: '123e4567-e89b-12d3-a456-426614174000',
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

    const response = await request(app)
      .post('/api/v1/worker/orders/123e4567-e89b-12d3-a456-426614174000/process')
      .send({
        items: [{ laundryItemId: VALID_UUID, quantity: 2 }],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'success',
      message: 'Worker order processed successfully',
      data: {
        orderId: '123e4567-e89b-12d3-a456-426614174000',
        stationRecordId: 'station-record-3',
        station: 'PACKING',
        stationStatus: 'COMPLETED',
        orderStatus: 'WAITING_FOR_PAYMENT',
        completedAt: '2026-04-18T03:00:00.000Z',
      },
    });
  });

  it('completes packing for paid orders and marks them ready for delivery', async () => {
    mockWorkerAuth({ workerType: 'PACKING' });
    const completedAt = new Date('2026-04-18T04:00:00.000Z');
    const mockTx = {
      stationRecord: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'station-record-4',
            orderId: '123e4567-e89b-12d3-a456-426614174000',
            station: 'PACKING',
            staffId: 'staff-worker',
            status: 'IN_PROGRESS',
            order: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              status: 'LAUNDRY_BEING_PACKED',
              paymentStatus: 'PAID',
              outletId: 'outlet-1',
            },
            stationItems: [],
          })
          .mockResolvedValueOnce({
            id: 'station-record-2',
            station: 'IRONING',
            stationItems: [{ laundryItemId: VALID_UUID, quantity: 4 }],
          }),
        update: jest.fn().mockResolvedValue({
          id: 'station-record-4',
          orderId: '123e4567-e89b-12d3-a456-426614174000',
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

    const response = await request(app)
      .post('/api/v1/worker/orders/123e4567-e89b-12d3-a456-426614174000/process')
      .send({
        items: [{ laundryItemId: VALID_UUID, quantity: 4 }],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'success',
      message: 'Worker order processed successfully',
      data: {
        orderId: '123e4567-e89b-12d3-a456-426614174000',
        stationRecordId: 'station-record-4',
        station: 'PACKING',
        stationStatus: 'COMPLETED',
        orderStatus: 'LAUNDRY_READY_FOR_DELIVERY',
        completedAt: '2026-04-18T04:00:00.000Z',
      },
    });
  });
});
