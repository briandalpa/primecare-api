import type { Request, Response } from 'express';

jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((h: Record<string, string | string[] | undefined>) => h),
  toNodeHandler: jest.fn(() => (_req: Request, res: Response) => res.json({ ok: true })),
}));

jest.mock('@/application/database', () => {
  const txOrderMock = { findUnique: jest.fn(), update: jest.fn() };
  const orderMock   = { findMany: jest.fn(), count: jest.fn(), ...txOrderMock };
  const userMock    = { findUnique: jest.fn() };
  const staffMock   = { findUnique: jest.fn() };
  return {
    prisma: {
      order:  orderMock,
      user:   userMock,
      staff:  staffMock,
      $transaction: jest.fn().mockImplementation(async (cb: Function) =>
        cb({ order: txOrderMock })
      ),
    },
  };
});

jest.mock('@/utils/auth', () => ({
  auth: { api: { getSession: jest.fn() } },
}));

jest.mock('@/application/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import request from 'supertest';
import { app } from '@/application/app';
import { prisma } from '@/application/database';
import { auth } from '@/utils/auth';

const orderMock  = prisma.order  as jest.Mocked<typeof prisma.order>;
const userMock   = prisma.user   as jest.Mocked<typeof prisma.user>;
const staffMock  = prisma.staff  as jest.Mocked<typeof prisma.staff>;
const getSession = auth.api.getSession as unknown as jest.Mock;

const CUSTOMER_ID = '550e8400-e29b-41d4-a716-446655440000';
const ORDER_ID    = '550e8400-e29b-41d4-a716-446655440010';
const CONFIRMED_AT = new Date('2026-04-02T10:00:00.000Z');

const mockUser = { id: CUSTOMER_ID, email: 'customer@example.com', name: 'Test Customer' };

const authenticatedAsCustomer = () => {
  getSession.mockResolvedValue({ user: mockUser });
  userMock.findUnique.mockResolvedValue(mockUser as never);
  staffMock.findUnique.mockResolvedValue(null as never);
};

beforeEach(() => jest.clearAllMocks());

// ── PATCH /api/v1/orders/:id/confirm ─────────────────────────────────────────

describe('PATCH /api/v1/orders/:id/confirm', () => {
  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);

    const res = await request(app).patch(`/api/v1/orders/${ORDER_ID}/confirm`);
    expect(res.status).toBe(401);
  });

  it('returns 400 when order ID is not a valid UUID', async () => {
    authenticatedAsCustomer();

    const res = await request(app).patch('/api/v1/orders/not-a-uuid/confirm');
    expect(res.status).toBe(400);
  });

  it('returns 404 when order does not exist', async () => {
    authenticatedAsCustomer();
    orderMock.findUnique.mockResolvedValue(null);

    const res = await request(app).patch(`/api/v1/orders/${ORDER_ID}/confirm`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Order not found');
  });

  it('returns 404 when order belongs to a different customer', async () => {
    authenticatedAsCustomer();
    orderMock.findUnique.mockResolvedValue({
      id: ORDER_ID, status: 'LAUNDRY_DELIVERED_TO_CUSTOMER',
      pickupRequest: { customerId: 'other-customer-id' },
    } as never);

    const res = await request(app).patch(`/api/v1/orders/${ORDER_ID}/confirm`);
    expect(res.status).toBe(404);
  });

  it('returns 409 when order is not in LAUNDRY_DELIVERED_TO_CUSTOMER status', async () => {
    authenticatedAsCustomer();
    orderMock.findUnique.mockResolvedValue({
      id: ORDER_ID, status: 'WAITING_FOR_PAYMENT',
      pickupRequest: { customerId: CUSTOMER_ID },
    } as never);

    const res = await request(app).patch(`/api/v1/orders/${ORDER_ID}/confirm`);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Order cannot be confirmed at this stage');
  });

  it('returns 200 with COMPLETED status and confirmedAt on success', async () => {
    authenticatedAsCustomer();
    orderMock.findUnique.mockResolvedValue({
      id: ORDER_ID, status: 'LAUNDRY_DELIVERED_TO_CUSTOMER',
      pickupRequest: { customerId: CUSTOMER_ID },
    } as never);
    orderMock.update.mockResolvedValue({
      id: ORDER_ID, status: 'COMPLETED', confirmedAt: CONFIRMED_AT,
    } as never);

    const res = await request(app).patch(`/api/v1/orders/${ORDER_ID}/confirm`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toBe('Order confirmed as received');
    expect(res.body.data).toMatchObject({
      id:          ORDER_ID,
      status:      'COMPLETED',
      confirmedAt: CONFIRMED_AT.toISOString(),
    });
  });
});
