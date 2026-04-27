import type { Request, Response } from 'express';

jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((h: Record<string, string | string[] | undefined>) => h),
  toNodeHandler: jest.fn(() => (_req: Request, res: Response) => res.json({ ok: true })),
}));

jest.mock('@/application/database', () => {
  const deliveryMock = {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  };
  const pickupRequestMock = { findFirst: jest.fn() };
  const userMock = { findUnique: jest.fn() };
  const staffMock = { findUnique: jest.fn() };
  const orderMock = { update: jest.fn() };
  return {
    prisma: {
      delivery: deliveryMock,
      pickupRequest: pickupRequestMock,
      user: userMock,
      staff: staffMock,
      order: orderMock,
      orderItem: {},
      $transaction: jest.fn().mockImplementation(async (input: unknown) => {
        if (Array.isArray(input)) return Promise.all(input);
        return (input as Function)({
          delivery: deliveryMock,
          pickupRequest: pickupRequestMock,
          order: orderMock,
        });
      }),
    },
  };
});

jest.mock('@/utils/auth', () => ({
  auth: { api: { getSession: jest.fn() } },
}));

import request from 'supertest';
import { app } from '@/application/app';
import { prisma } from '@/application/database';
import { auth } from '@/utils/auth';
import {
  makeDelivery,
  makeOrder,
  makePickupRequestForDelivery,
  makeDeliveryAddress,
  makeCustomerUser,
} from '../factories/delivery.factory';

const deliveryMock = prisma.delivery as jest.Mocked<typeof prisma.delivery>;
const pickupRequestMock = prisma.pickupRequest as jest.Mocked<typeof prisma.pickupRequest>;
const userMock = prisma.user as jest.Mocked<typeof prisma.user>;
const staffMock = prisma.staff as jest.Mocked<typeof prisma.staff>;
const orderMock = prisma.order as jest.Mocked<typeof prisma.order>;
const getSession = auth.api.getSession as unknown as jest.Mock;

const mockUser = { id: '550e8400-e29b-41d4-a716-446655440000', name: 'John Doe', email: 'john@example.com', phone: '+628123456789' };
const mockStaff = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  userId: '550e8400-e29b-41d4-a716-446655440000',
  outletId: '550e8400-e29b-41d4-a716-446655440002',
  role: 'DRIVER',
  workerType: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const authenticatedAsDriver = (staff = mockStaff, u = mockUser) => {
  getSession.mockResolvedValue({ user: u });
  userMock.findUnique.mockResolvedValue(u as never);
  staffMock.findUnique.mockResolvedValue(staff as never);
};

const authenticatedAsStaff = (role = 'WORKER') => {
  const staff = { ...mockStaff, role };
  getSession.mockResolvedValue({ user: mockUser });
  userMock.findUnique.mockResolvedValue(mockUser as never);
  staffMock.findUnique.mockResolvedValue(staff as never);
};

const authenticatedAsCustomer = () => {
  getSession.mockResolvedValue({ user: mockUser });
  userMock.findUnique.mockResolvedValue(mockUser as never);
  staffMock.findUnique.mockResolvedValue(null as never);
};

const makeDeliveryWithChain = (deliveryOverrides: object = {}, orderOverrides: object = {}) => {
  const address = makeDeliveryAddress();
  const customerUser = makeCustomerUser();
  const pickupRequest = { ...makePickupRequestForDelivery(), address, customerUser };
  const order = { ...makeOrder({ ...orderOverrides }), pickupRequest };
  return { ...makeDelivery({ ...deliveryOverrides }), order };
};

const deliveryId = '660e8400-e29b-41d4-a716-446655440010';

beforeEach(() => jest.clearAllMocks());

// ─── GET /api/v1/deliveries ───────────────────────────────────────────────────

describe('GET /api/v1/deliveries', () => {
  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/deliveries');
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated user is not a DRIVER', async () => {
    authenticatedAsStaff('WORKER');
    const res = await request(app).get('/api/v1/deliveries');
    expect(res.status).toBe(403);
  });

  it('returns 403 when authenticated user is a customer', async () => {
    authenticatedAsCustomer();
    const res = await request(app).get('/api/v1/deliveries');
    expect(res.status).toBe(403);
  });

  it('returns 409 when driver has no outlet assigned', async () => {
    authenticatedAsDriver({ ...mockStaff, outletId: null as unknown as string });
    const res = await request(app).get('/api/v1/deliveries');
    expect(res.status).toBe(409);
  });

  it('returns 200 with paginated deliveries and customer info', async () => {
    authenticatedAsDriver();
    const delivery = makeDeliveryWithChain();

    deliveryMock.findMany.mockResolvedValue([delivery] as never);
    deliveryMock.count.mockResolvedValue(1);

    const res = await request(app).get('/api/v1/deliveries');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toBe('Deliveries retrieved');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toHaveProperty('customer.name', 'John Doe');
    expect(res.body.data[0].deliveryAddress).toHaveProperty('label', 'Home');
    expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('defaults status to PENDING when not provided', async () => {
    authenticatedAsDriver();
    deliveryMock.findMany.mockResolvedValue([]);
    deliveryMock.count.mockResolvedValue(0);

    await request(app).get('/api/v1/deliveries');

    expect(deliveryMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PENDING' }),
      })
    );
  });

  it('returns 400 when status is an invalid value', async () => {
    authenticatedAsDriver();
    const res = await request(app).get('/api/v1/deliveries?status=INVALID_STATUS');
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /api/v1/deliveries/:id/accept ─────────────────────────────────────

describe('PATCH /api/v1/deliveries/:id/accept', () => {
  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).patch(`/api/v1/deliveries/${deliveryId}/accept`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated user is not a DRIVER', async () => {
    authenticatedAsStaff('WORKER');
    const res = await request(app).patch(`/api/v1/deliveries/${deliveryId}/accept`);
    expect(res.status).toBe(403);
  });

  it('returns 400 when delivery id is not a valid UUID', async () => {
    authenticatedAsDriver();
    const res = await request(app).patch('/api/v1/deliveries/not-a-uuid/accept');
    expect(res.status).toBe(400);
  });

  it('returns 200 and accepts the delivery', async () => {
    authenticatedAsDriver();
    pickupRequestMock.findFirst.mockResolvedValueOnce(null);
    deliveryMock.findFirst.mockResolvedValueOnce(null);

    const updatedDelivery = {
      ...makeDelivery({ status: 'DRIVER_ASSIGNED', driverId: mockStaff.id }),
      order: makeOrder({ outletId: mockStaff.outletId }),
    };
    deliveryMock.update.mockResolvedValue(updatedDelivery as never);
    orderMock.update.mockResolvedValue({} as never);

    const res = await request(app).patch(`/api/v1/deliveries/${deliveryId}/accept`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toBe('Delivery accepted');
    expect(res.body.data.status).toBe('DRIVER_ASSIGNED');
    expect(res.body.data.driverId).toBe(mockStaff.id);
    expect(res.body.data.orderStatus).toBe('LAUNDRY_OUT_FOR_DELIVERY');
  });

  it('returns 409 when driver already has an active task', async () => {
    authenticatedAsDriver();
    const activePickup = { id: 'pickup-1', status: 'DRIVER_ASSIGNED', driverId: mockStaff.id };
    pickupRequestMock.findFirst.mockResolvedValueOnce(activePickup as never);

    const res = await request(app).patch(`/api/v1/deliveries/${deliveryId}/accept`);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Driver already has an active task');
  });

  it('returns 404 when delivery not found or already assigned', async () => {
    authenticatedAsDriver();
    pickupRequestMock.findFirst.mockResolvedValueOnce(null);
    deliveryMock.findFirst.mockResolvedValueOnce(null);
    deliveryMock.update.mockRejectedValue(new Error('Record not found'));

    const res = await request(app).patch(`/api/v1/deliveries/${deliveryId}/accept`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Delivery not found');
  });

  it('returns 409 when driver has no outlet assigned', async () => {
    authenticatedAsDriver({ ...mockStaff, outletId: null as unknown as string });
    const res = await request(app).patch(`/api/v1/deliveries/${deliveryId}/accept`);
    expect(res.status).toBe(409);
  });
});

// ─── PATCH /api/v1/deliveries/:id/complete ───────────────────────────────────

describe('PATCH /api/v1/deliveries/:id/complete', () => {
  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).patch(`/api/v1/deliveries/${deliveryId}/complete`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated user is not a DRIVER', async () => {
    authenticatedAsStaff('WORKER');
    const res = await request(app).patch(`/api/v1/deliveries/${deliveryId}/complete`);
    expect(res.status).toBe(403);
  });

  it('returns 400 when delivery id is not a valid UUID', async () => {
    authenticatedAsDriver();
    const res = await request(app).patch('/api/v1/deliveries/not-a-uuid/complete');
    expect(res.status).toBe(400);
  });

  it('returns 200 with DELIVERED status and deliveredAt', async () => {
    authenticatedAsDriver();
    const delivery = makeDelivery({ id: deliveryId, status: 'DRIVER_ASSIGNED', driverId: mockStaff.id });
    deliveryMock.findFirst.mockResolvedValueOnce(delivery as never);

    const deliveredAt = new Date();
    const updatedDelivery = { ...delivery, status: 'DELIVERED', deliveredAt };
    deliveryMock.update.mockResolvedValue(updatedDelivery as never);
    orderMock.update.mockResolvedValue({} as never);

    const res = await request(app).patch(`/api/v1/deliveries/${deliveryId}/complete`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toBe('Delivery completed. Customer notified.');
    expect(res.body.data.status).toBe('DELIVERED');
    expect(res.body.data.orderStatus).toBe('LAUNDRY_DELIVERED_TO_CUSTOMER');
    expect(res.body.data.deliveredAt).toBeDefined();
  });

  it('returns 404 when delivery not found or not in DRIVER_ASSIGNED state', async () => {
    authenticatedAsDriver();
    deliveryMock.findFirst.mockResolvedValueOnce(null);

    const res = await request(app).patch(`/api/v1/deliveries/${deliveryId}/complete`);

    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not the assigned driver', async () => {
    authenticatedAsDriver();
    const otherDriverId = '550e8400-e29b-41d4-a716-446655440099';
    const delivery = makeDelivery({ id: deliveryId, status: 'DRIVER_ASSIGNED', driverId: otherDriverId });
    deliveryMock.findFirst.mockResolvedValueOnce(delivery as never);

    const res = await request(app).patch(`/api/v1/deliveries/${deliveryId}/complete`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('You are not the assigned driver for this delivery');
  });
});

// ─── GET /api/v1/deliveries/history ──────────────────────────────────────────

describe('GET /api/v1/deliveries/history', () => {
  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/deliveries/history');
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated user is not a DRIVER', async () => {
    authenticatedAsStaff('WORKER');
    const res = await request(app).get('/api/v1/deliveries/history');
    expect(res.status).toBe(403);
  });

  it('returns 409 when driver has no outlet assigned', async () => {
    authenticatedAsDriver({ ...mockStaff, outletId: null as unknown as string });
    const res = await request(app).get('/api/v1/deliveries/history');
    expect(res.status).toBe(409);
  });

  it('returns 200 with delivery history items and meta', async () => {
    authenticatedAsDriver();
    const deliveredAt = new Date();
    const delivery = makeDeliveryWithChain({ status: 'DELIVERED', driverId: mockStaff.id, deliveredAt });

    deliveryMock.findMany.mockResolvedValue([delivery] as never);
    deliveryMock.count.mockResolvedValue(1);

    const res = await request(app).get('/api/v1/deliveries/history');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toBe('Delivery history retrieved');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toHaveProperty('customer.name', 'John Doe');
    expect(res.body.data[0].deliveryAddress).toHaveProperty('label', 'Home');
    expect(res.body.data[0].deliveryAddress).not.toHaveProperty('latitude');
    expect(res.body.meta).toHaveProperty('total', 1);
  });

  it('does not expose lat/lng in history response', async () => {
    authenticatedAsDriver();
    const delivery = makeDeliveryWithChain({ status: 'DELIVERED', driverId: mockStaff.id, deliveredAt: new Date() });

    deliveryMock.findMany.mockResolvedValue([delivery] as never);
    deliveryMock.count.mockResolvedValue(1);

    const res = await request(app).get('/api/v1/deliveries/history');

    expect(res.body.data[0].deliveryAddress).not.toHaveProperty('latitude');
    expect(res.body.data[0].deliveryAddress).not.toHaveProperty('longitude');
  });
});

// ─── GET /api/v1/deliveries/:id/order ────────────────────────────────────────

describe('GET /api/v1/deliveries/:id/order', () => {
  const makeDeliveryWithOrderItems = () => ({
    ...makeDelivery({ id: deliveryId, driverId: mockStaff.id }),
    order: {
      ...makeOrder(),
      items: [
        { id: 'item-1', quantity: 2, unitPrice: 5000, laundryItem: { id: 'li-1', name: 'Shirt' } },
        { id: 'item-2', quantity: 1, unitPrice: 8000, laundryItem: { id: 'li-2', name: 'Pants' } },
      ],
    },
  });

  it('returns 200 with order summary when driver is assigned to delivery', async () => {
    authenticatedAsDriver();
    deliveryMock.findFirst.mockResolvedValue(makeDeliveryWithOrderItems() as never);

    const res = await request(app).get(`/api/v1/deliveries/${deliveryId}/order`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('items');
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data).toHaveProperty('totalPrice');
    expect(res.body.data).toHaveProperty('deliveryFee');
    expect(res.body.data).toHaveProperty('paymentStatus');
  });

  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).get(`/api/v1/deliveries/${deliveryId}/order`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when not a DRIVER', async () => {
    authenticatedAsStaff('WORKER');
    const res = await request(app).get(`/api/v1/deliveries/${deliveryId}/order`);
    expect(res.status).toBe(403);
  });

  it('returns 400 when delivery ID is not a valid UUID', async () => {
    authenticatedAsDriver();
    const res = await request(app).get('/api/v1/deliveries/not-a-uuid/order');
    expect(res.status).toBe(400);
  });

  it('returns 404 when delivery not found or not assigned to caller', async () => {
    authenticatedAsDriver();
    deliveryMock.findFirst.mockResolvedValue(null);

    const res = await request(app).get(`/api/v1/deliveries/${deliveryId}/order`);
    expect(res.status).toBe(404);
  });
});
