import type { Request, Response } from 'express';

jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((h: Record<string, string | string[] | undefined>) => h),
  toNodeHandler: jest.fn(() => (_req: Request, res: Response) => res.json({ ok: true })),
}));

jest.mock('@/application/database', () => {
  const pickupRequestMock = {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  };
  const addressMock = { findUnique: jest.fn() };
  const outletMock = { findMany: jest.fn() };
  const userMock = { findUnique: jest.fn() };
  const staffMock = { findUnique: jest.fn() };
  const deliveryMock = { findFirst: jest.fn() };
  const orderMock = { update: jest.fn() };
  return {
    prisma: {
      pickupRequest: pickupRequestMock,
      address: addressMock,
      outlet: outletMock,
      user: userMock,
      staff: staffMock,
      delivery: deliveryMock,
      order: orderMock,
      $transaction: jest.fn().mockImplementation(async (input: unknown) => {
        // Handle both array form (Prisma batch) and callback form (tx)
        if (Array.isArray(input)) {
          // Array form: resolve all promises
          return Promise.all(input);
        }
        // Callback form: call the function with tx object
        return (input as Function)({
          pickupRequest: pickupRequestMock,
          delivery: deliveryMock,
          order: orderMock,
        });
      }),
    },
  };
});

jest.mock('@/utils/haversine', () => ({
  haversineDistance: jest.fn(),
}));

jest.mock('@/utils/auth', () => ({
  auth: { api: { getSession: jest.fn() } },
}));

import request from 'supertest';
import { app } from '@/application/app';
import { prisma } from '@/application/database';
import { auth } from '@/utils/auth';
import { haversineDistance } from '@/utils/haversine';
import { makeAddress, makeOutlet, makePickupRequest } from '../factories/pickup-request.factory';

const pickupRequestMock = prisma.pickupRequest as jest.Mocked<typeof prisma.pickupRequest>;
const addressMock = prisma.address as jest.Mocked<typeof prisma.address>;
const outletMock = prisma.outlet as jest.Mocked<typeof prisma.outlet>;
const userMock = prisma.user as jest.Mocked<typeof prisma.user>;
const staffMock = prisma.staff as jest.Mocked<typeof prisma.staff>;
const deliveryMock = prisma.delivery as jest.Mocked<typeof prisma.delivery>;
const orderMock = prisma.order as jest.Mocked<typeof prisma.order>;
const getSession = auth.api.getSession as unknown as jest.Mock;
const haversineDistanceMock = haversineDistance as unknown as jest.Mock;

const mockUser = { id: '550e8400-e29b-41d4-a716-446655440000', name: 'John Doe', email: 'john@example.com', phone: '+628123456789' };
const mockStaff = { id: '550e8400-e29b-41d4-a716-446655440001', userId: '550e8400-e29b-41d4-a716-446655440000', outletId: '550e8400-e29b-41d4-a716-446655440002', role: 'DRIVER', workerType: null, isActive: true, createdAt: new Date(), updatedAt: new Date() };

const authenticatedAsCustomer = (u = mockUser) => {
  getSession.mockResolvedValue({ user: u });
  userMock.findUnique.mockResolvedValue(u as never);
  staffMock.findUnique.mockResolvedValue(null as never); // no Staff record = customer
};

const authenticatedAsDriver = (staff = mockStaff, u = mockUser) => {
  getSession.mockResolvedValue({ user: u });
  userMock.findUnique.mockResolvedValue(u as never);
  staffMock.findUnique.mockResolvedValue(staff as never);
};

const authenticatedAsStaff = (role = 'WORKER', u = mockUser) => {
  const staff = { ...mockStaff, role };
  getSession.mockResolvedValue({ user: u });
  userMock.findUnique.mockResolvedValue(u as never);
  staffMock.findUnique.mockResolvedValue(staff as never);
};

beforeEach(() => jest.clearAllMocks());

// ─── PCS-80: Create Pickup Request ──────────────────────────────────────────────

describe('POST /api/v1/pickup-requests', () => {
  const validBody = {
    addressId: '550e8400-e29b-41d4-a716-446655440003',
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).post('/api/v1/pickup-requests').send(validBody);
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated user is a staff member', async () => {
    authenticatedAsStaff('WORKER');
    const res = await request(app).post('/api/v1/pickup-requests').send(validBody);
    expect(res.status).toBe(403);
  });

  it('returns 400 when scheduledAt is not far enough in the future', async () => {
    authenticatedAsCustomer();
    const res = await request(app)
      .post('/api/v1/pickup-requests')
      .send({
        addressId: validBody.addressId,
        scheduledAt: '2020-04-01T09:00:00Z', // past date
      });
    expect(res.status).toBe(400);
  });

  it('returns 403 when addressId does not belong to customer', async () => {
    authenticatedAsCustomer();
    const otherUserUUID = '550e8400-e29b-41d4-a716-446655440099';
    addressMock.findUnique.mockResolvedValue(makeAddress({ userId: otherUserUUID }) as never);
    const res = await request(app).post('/api/v1/pickup-requests').send(validBody);
    expect(res.status).toBe(403);
  });

  it('returns 201 with outlet info for a valid request', async () => {
    authenticatedAsCustomer();
    const address = makeAddress();
    const outlet = makeOutlet();

    addressMock.findUnique.mockResolvedValue(address as never);
    pickupRequestMock.findFirst.mockResolvedValue(null); // no duplicate
    outletMock.findMany.mockResolvedValue([outlet] as never);
    haversineDistanceMock.mockReturnValue(5);

    pickupRequestMock.create.mockResolvedValue(
      makePickupRequest({ outlet }) as never
    );

    const res = await request(app).post('/api/v1/pickup-requests').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('outlet');
    expect(res.body.data.outlet.id).toBe('550e8400-e29b-41d4-a716-446655440002');
  });

  it('returns 409 when duplicate pending request exists', async () => {
    authenticatedAsCustomer();
    const address = makeAddress();
    const existingPickup = makePickupRequest();

    addressMock.findUnique.mockResolvedValue(address as never);
    pickupRequestMock.findFirst.mockResolvedValue(existingPickup as never);

    const res = await request(app).post('/api/v1/pickup-requests').send(validBody);

    expect(res.status).toBe(409);
  });
});

// ─── PCS-81: Customer — My Pickup Requests ─────────────────────────────────────

describe('GET /api/v1/pickup-requests/my', () => {
  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/pickup-requests/my');
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated user is staff', async () => {
    authenticatedAsStaff('DRIVER');
    const res = await request(app).get('/api/v1/pickup-requests/my');
    expect(res.status).toBe(403);
  });

  it('returns 200 with paginated customer pickups', async () => {
    authenticatedAsCustomer();
    const outlet = makeOutlet();
    const pickup = makePickupRequest({ customerId: mockUser.id });

    pickupRequestMock.findMany.mockResolvedValue([{ ...pickup, outlet }] as never);
    pickupRequestMock.count.mockResolvedValue(1);

    const res = await request(app).get('/api/v1/pickup-requests/my');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toHaveProperty('outletName', outlet.name);
    expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('filters by status when provided', async () => {
    authenticatedAsCustomer();
    pickupRequestMock.findMany.mockResolvedValue([]);
    pickupRequestMock.count.mockResolvedValue(0);

    await request(app).get('/api/v1/pickup-requests/my?status=PENDING');

    expect(pickupRequestMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PENDING' }),
      })
    );
  });
});

// ─── PCS-82: List Unassigned Pickup Requests ───────────────────────────────────

describe('GET /api/v1/pickup-requests', () => {
  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/pickup-requests');
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated user is not a DRIVER', async () => {
    authenticatedAsStaff('WORKER');
    const res = await request(app).get('/api/v1/pickup-requests');
    expect(res.status).toBe(403);
  });

  it('returns 409 when driver has no outlet assigned', async () => {
    authenticatedAsDriver({ ...mockStaff, outletId: null as unknown as string });
    const res = await request(app).get('/api/v1/pickup-requests');
    expect(res.status).toBe(409);
  });

  it('returns 200 with correct meta', async () => {
    authenticatedAsDriver();
    const pickup1 = makePickupRequest();
    const user2UUID = '550e8400-e29b-41d4-a716-446655440098';
    const addr2UUID = '550e8400-e29b-41d4-a716-446655440097';
    const pickup2UUID = '550e8400-e29b-41d4-a716-446655440096';
    const pickup2 = makePickupRequest({ id: pickup2UUID, customerId: user2UUID, addressId: addr2UUID });

    pickupRequestMock.findMany.mockResolvedValue([
      {
        ...pickup1,
        address: makeAddress(),
        customerUser: { id: '550e8400-e29b-41d4-a716-446655440000', name: 'John', phone: '+628123456789', email: '', emailVerified: false, image: null, avatarUrl: null, role: 'CUSTOMER', createdAt: new Date(), updatedAt: new Date() },
      },
      {
        ...pickup2,
        address: makeAddress({ id: addr2UUID, userId: user2UUID }),
        customerUser: { id: user2UUID, name: 'Jane', phone: '+628987654321', email: '', emailVerified: false, image: null, avatarUrl: null, role: 'CUSTOMER', createdAt: new Date(), updatedAt: new Date() },
      },
    ] as never);

    pickupRequestMock.count.mockResolvedValue(35);

    const res = await request(app).get('/api/v1/pickup-requests?page=1&limit=10');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 10,
      total: 35,
      totalPages: 4,
    });
  });

  it('defaults page=1 and limit=10 when query params are omitted', async () => {
    authenticatedAsDriver();
    pickupRequestMock.findMany.mockResolvedValue([]);
    pickupRequestMock.count.mockResolvedValue(0);

    await request(app).get('/api/v1/pickup-requests');

    expect(pickupRequestMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10,
      })
    );
  });

  it('includes address and customer info in response', async () => {
    authenticatedAsDriver();
    const address = makeAddress();
    const customer = { id: 'user-1', name: 'Budi Santoso', phone: '+628123456789', email: '', emailVerified: false, image: null, avatarUrl: null, role: 'CUSTOMER', createdAt: new Date(), updatedAt: new Date() };

    pickupRequestMock.findMany.mockResolvedValue([
      {
        ...makePickupRequest(),
        address,
        customerUser: customer,
      },
    ] as never);

    pickupRequestMock.count.mockResolvedValue(1);

    const res = await request(app).get('/api/v1/pickup-requests');

    expect(res.body.data[0].address).toEqual({
      label: address.label,
      street: address.street,
      city: address.city,
      province: address.province,
      latitude: address.latitude,
      longitude: address.longitude,
      phone: address.phone,
    });

    expect(res.body.data[0].customer).toEqual({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
    });
  });

  it('returns 403 when authenticated customer calls GET /pickup-requests', async () => {
    authenticatedAsCustomer();
    const res = await request(app).get('/api/v1/pickup-requests');
    expect(res.status).toBe(403);
  });
});

// ─── PCS-83: Driver — Accept Pickup Request ────────────────────────────────────

describe('PATCH /api/v1/pickup-requests/:id', () => {
  const pickupId = '550e8400-e29b-41d4-a716-446655440004';

  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).patch(`/api/v1/pickup-requests/${pickupId}`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated user is not a DRIVER', async () => {
    authenticatedAsStaff('WORKER');
    const res = await request(app).patch(`/api/v1/pickup-requests/${pickupId}`);
    expect(res.status).toBe(403);
  });

  it('returns 400 when pickup request id is not a valid UUID', async () => {
    authenticatedAsDriver();
    const res = await request(app).patch('/api/v1/pickup-requests/invalid-id');
    expect(res.status).toBe(400);
  });

  it('returns 404 when pickup request not found or already assigned', async () => {
    authenticatedAsDriver();
    pickupRequestMock.findFirst.mockResolvedValueOnce(null);
    deliveryMock.findFirst.mockResolvedValueOnce(null);
    pickupRequestMock.update.mockRejectedValue(new Error('An operation failed'));

    const res = await request(app).patch(`/api/v1/pickup-requests/${pickupId}`);

    expect(res.status).toBe(404);
  });

  it('accepts pickup request and returns orderStatus', async () => {
    authenticatedAsDriver();

    pickupRequestMock.findFirst.mockResolvedValueOnce(null); // no active pickup
    deliveryMock.findFirst.mockResolvedValueOnce(null); // no active delivery
    pickupRequestMock.update.mockResolvedValue(
      makePickupRequest({ status: 'DRIVER_ASSIGNED', driverId: mockStaff.id }) as never
    );
    orderMock.update.mockResolvedValue({} as never);

    const res = await request(app).patch(`/api/v1/pickup-requests/${pickupId}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.status).toBe('DRIVER_ASSIGNED');
    expect(res.body.data.driverId).toBe(mockStaff.id);
    expect(res.body.data.orderStatus).toBe('LAUNDRY_EN_ROUTE_TO_OUTLET');
  });

  it('returns 409 when driver already has active task', async () => {
    authenticatedAsDriver();
    const activePickup = makePickupRequest({ status: 'DRIVER_ASSIGNED', driverId: mockStaff.id });

    pickupRequestMock.findFirst.mockResolvedValueOnce(activePickup as never);

    const res = await request(app).patch(`/api/v1/pickup-requests/${pickupId}`);

    expect(res.status).toBe(409);
  });

  it('returns 403 when pickup request belongs to different outlet', async () => {
    authenticatedAsDriver();
    const differentOutletId = '550e8400-e29b-41d4-a716-446655440095';
    const pickup = makePickupRequest({ outletId: differentOutletId });

    pickupRequestMock.findFirst.mockResolvedValueOnce(null);
    deliveryMock.findFirst.mockResolvedValueOnce(null);
    pickupRequestMock.update.mockResolvedValue(pickup as never);

    const res = await request(app).patch(`/api/v1/pickup-requests/${pickupId}`);

    expect(res.status).toBe(403);
  });
});

// ─── PCS-84: Driver — Complete Pickup Request ──────────────────────────────────

describe('PATCH /api/v1/pickup-requests/:id/complete', () => {
  const pickupId = '550e8400-e29b-41d4-a716-446655440004';

  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).patch(`/api/v1/pickup-requests/${pickupId}/complete`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated user is not a DRIVER', async () => {
    authenticatedAsStaff('WORKER');
    const res = await request(app).patch(`/api/v1/pickup-requests/${pickupId}/complete`);
    expect(res.status).toBe(403);
  });

  it('returns 400 when pickup request id is not a valid UUID', async () => {
    authenticatedAsDriver();
    const res = await request(app).patch('/api/v1/pickup-requests/invalid-id/complete');
    expect(res.status).toBe(400);
  });

  it('returns 404 when pickup is not found or not DRIVER_ASSIGNED', async () => {
    authenticatedAsDriver();
    pickupRequestMock.findFirst.mockResolvedValueOnce(null);

    const res = await request(app).patch(`/api/v1/pickup-requests/${pickupId}/complete`);

    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not the assigned driver', async () => {
    authenticatedAsDriver();
    const otherDriverId = '550e8400-e29b-41d4-a716-446655440099';
    const pickup = makePickupRequest({ id: pickupId, status: 'DRIVER_ASSIGNED', driverId: otherDriverId });
    pickupRequestMock.findFirst.mockResolvedValueOnce(pickup as never);

    const res = await request(app).patch(`/api/v1/pickup-requests/${pickupId}/complete`);

    expect(res.status).toBe(403);
  });

  it('returns 200 with PICKED_UP status and orderStatus', async () => {
    authenticatedAsDriver();
    const pickup = makePickupRequest({ id: pickupId, status: 'DRIVER_ASSIGNED', driverId: mockStaff.id });
    pickupRequestMock.findFirst.mockResolvedValueOnce(pickup as never);
    pickupRequestMock.update.mockResolvedValue({ ...pickup, status: 'PICKED_UP' } as never);
    orderMock.update.mockResolvedValue({} as never);

    const res = await request(app).patch(`/api/v1/pickup-requests/${pickupId}/complete`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.status).toBe('PICKED_UP');
    expect(res.body.data.orderStatus).toBe('LAUNDRY_ARRIVED_AT_OUTLET');
  });
});

// ─── PCS-85: Driver — Pickup History ───────────────────────────────────────────

describe('GET /api/v1/pickup-requests/history', () => {
  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/pickup-requests/history');
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated user is not a DRIVER', async () => {
    authenticatedAsStaff('WORKER');
    const res = await request(app).get('/api/v1/pickup-requests/history');
    expect(res.status).toBe(403);
  });

  it('returns 409 when driver has no outlet assigned', async () => {
    authenticatedAsDriver({ ...mockStaff, outletId: null as unknown as string });
    const res = await request(app).get('/api/v1/pickup-requests/history');
    expect(res.status).toBe(409);
  });

  it('returns 200 with history items and meta', async () => {
    authenticatedAsDriver();
    const address = makeAddress();
    const customerUser = { id: 'cust-1', name: 'Budi', phone: '+6281', email: '', emailVerified: false, image: null, avatarUrl: null, role: 'CUSTOMER', createdAt: new Date(), updatedAt: new Date() };
    const pickup = makePickupRequest({ status: 'PICKED_UP', driverId: mockStaff.id });

    pickupRequestMock.findMany.mockResolvedValue([
      { ...pickup, address, customerUser, outlet: makeOutlet(), order: { id: 'ord-1' } },
    ] as never);
    pickupRequestMock.count.mockResolvedValue(1);

    const res = await request(app).get('/api/v1/pickup-requests/history');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].orderId).toBe('ord-1');
    expect(res.body.data[0].customerName).toBe('Budi');
    expect(res.body.meta).toHaveProperty('total', 1);
  });
});
