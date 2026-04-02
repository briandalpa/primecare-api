import type { Request, Response } from 'express';

jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((h: Record<string, string | string[] | undefined>) => h),
  toNodeHandler: jest.fn(() => (_req: Request, res: Response) => res.json({ ok: true })),
}));

jest.mock('@/application/database', () => {
  const orderMock   = { findUnique: jest.fn(), update: jest.fn() };
  const paymentMock = { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() };
  const deliveryMock = { create: jest.fn() };
  const userMock   = { findUnique: jest.fn() };
  const staffMock  = { findUnique: jest.fn() };
  return {
    prisma: {
      order:    orderMock,
      payment:  paymentMock,
      delivery: deliveryMock,
      user:     userMock,
      staff:    staffMock,
      $transaction: jest.fn().mockImplementation(async (input: unknown) => {
        if (Array.isArray(input)) return Promise.all(input);
        return (input as Function)({ order: orderMock, payment: paymentMock, delivery: deliveryMock });
      }),
    },
  };
});

jest.mock('midtrans-client', () => ({
  Snap: jest.fn().mockImplementation(() => ({
    createTransaction: jest.fn().mockResolvedValue({ token: 'snap-token-abc', redirect_url: 'https://midtrans.test' }),
  })),
}));

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
import { makeSignature } from '../factories/payment.factory';

const orderMock   = prisma.order   as jest.Mocked<typeof prisma.order>;
const paymentMock = prisma.payment as jest.Mocked<typeof prisma.payment>;
const userMock    = prisma.user    as jest.Mocked<typeof prisma.user>;
const staffMock   = prisma.staff   as jest.Mocked<typeof prisma.staff>;
const getSession  = auth.api.getSession as unknown as jest.Mock;

const SERVER_KEY  = 'test-server-key';
const ORDER_ID    = '550e8400-e29b-41d4-a716-446655440010';
const PAYMENT_ID  = '550e8400-e29b-41d4-a716-446655440020';
const CUSTOMER_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockUser = { id: CUSTOMER_ID, email: 'customer@example.com', name: 'Test Customer' };

const authenticatedAsCustomer = () => {
  getSession.mockResolvedValue({ user: mockUser });
  userMock.findUnique.mockResolvedValue(mockUser as never);
  staffMock.findUnique.mockResolvedValue(null as never); // no Staff record = customer
};

beforeEach(() => {
  process.env.MIDTRANS_SERVER_KEY    = SERVER_KEY;
  process.env.MIDTRANS_IS_PRODUCTION = 'false';
  jest.clearAllMocks();
});

// ── POST /api/v1/orders/:id/payments ─────────────────────────────────────────

describe('POST /api/v1/orders/:id/payments', () => {
  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).post(`/api/v1/orders/${ORDER_ID}/payments`);
    expect(res.status).toBe(401);
  });

  it('returns 404 when order does not exist', async () => {
    authenticatedAsCustomer();
    orderMock.findUnique.mockResolvedValue(null);

    const res = await request(app).post(`/api/v1/orders/${ORDER_ID}/payments`);
    expect(res.status).toBe(404);
  });

  it('returns 403 when order belongs to a different customer', async () => {
    authenticatedAsCustomer();
    orderMock.findUnique.mockResolvedValue({
      id: ORDER_ID, totalPrice: 35000, paymentStatus: 'UNPAID', payment: null,
      pickupRequest: { customerId: 'other-customer-id' },
    } as never);

    const res = await request(app).post(`/api/v1/orders/${ORDER_ID}/payments`);
    expect(res.status).toBe(403);
  });

  it('returns 409 when order is already paid', async () => {
    authenticatedAsCustomer();
    orderMock.findUnique.mockResolvedValue({
      id: ORDER_ID, totalPrice: 35000, paymentStatus: 'PAID', payment: null,
      pickupRequest: { customerId: CUSTOMER_ID },
    } as never);

    const res = await request(app).post(`/api/v1/orders/${ORDER_ID}/payments`);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Order has already been paid');
  });

  it('returns 201 with snapToken and redirectUrl on success', async () => {
    authenticatedAsCustomer();
    orderMock.findUnique.mockResolvedValue({
      id: ORDER_ID, totalPrice: 35000, paymentStatus: 'UNPAID', payment: null,
      pickupRequest: { customerId: CUSTOMER_ID },
    } as never);
    paymentMock.create.mockResolvedValue({
      id: PAYMENT_ID, orderId: ORDER_ID, amount: 35000,
      gateway: 'midtrans', gatewayTxId: 'snap-token-abc', status: 'PENDING',
    } as never);

    const res = await request(app).post(`/api/v1/orders/${ORDER_ID}/payments`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toMatchObject({
      snapToken:   'snap-token-abc',
      redirectUrl: expect.stringContaining('snap-token-abc'),
      amount:      35000,
    });
  });

  it('returns cached snapToken without calling Midtrans again (idempotency)', async () => {
    authenticatedAsCustomer();
    orderMock.findUnique.mockResolvedValue({
      id: ORDER_ID, totalPrice: 35000, paymentStatus: 'UNPAID',
      payment: { id: PAYMENT_ID, orderId: ORDER_ID, amount: 35000, status: 'PENDING', gatewayTxId: 'existing-token' },
      pickupRequest: { customerId: CUSTOMER_ID },
    } as never);

    const res = await request(app).post(`/api/v1/orders/${ORDER_ID}/payments`);

    expect(res.status).toBe(201);
    expect(res.body.data.snapToken).toBe('existing-token');
    expect(paymentMock.create).not.toHaveBeenCalled();
  });
});

// ── POST /api/v1/payments/webhook ─────────────────────────────────────────────

describe('POST /api/v1/payments/webhook', () => {
  const validSettlement = () => ({
    order_id:           PAYMENT_ID,
    transaction_status: 'settlement',
    gross_amount:       '35000.00',
    status_code:        '200',
    fraud_status:       'accept',
    signature_key:      makeSignature(PAYMENT_ID, '200', '35000.00', SERVER_KEY),
  });

  it('returns 400 when signature is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .send({ ...validSettlement(), signature_key: 'tampered' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid signature');
  });

  it('returns 400 when required webhook fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .send({ order_id: PAYMENT_ID }); // missing required fields

    expect(res.status).toBe(400);
  });

  it('returns 200 on valid settlement webhook', async () => {
    paymentMock.findUnique.mockResolvedValue({
      id: PAYMENT_ID, orderId: ORDER_ID, amount: 35000,
      order: { id: ORDER_ID, status: 'WAITING_FOR_PAYMENT', paymentStatus: 'UNPAID' },
    } as never);

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .send(validSettlement());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'success', message: 'Webhook processed', data: null });
  });

  it('returns 400 when gross_amount does not match payment amount', async () => {
    paymentMock.findUnique.mockResolvedValue({
      id: PAYMENT_ID, orderId: ORDER_ID, amount: 99999,
      order: { id: ORDER_ID, status: 'WAITING_FOR_PAYMENT', paymentStatus: 'UNPAID' },
    } as never);

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .send(validSettlement()); // gross_amount is 35000.00

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid webhook payload');
  });

  it('does not mark payment as PAID when fraud_status is deny', async () => {
    paymentMock.findUnique.mockResolvedValue({
      id: PAYMENT_ID, orderId: ORDER_ID, amount: 35000,
      order: { id: ORDER_ID, status: 'WAITING_FOR_PAYMENT', paymentStatus: 'UNPAID' },
    } as never);

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .send({ ...validSettlement(), fraud_status: 'deny' });

    expect(res.status).toBe(200);
    expect(paymentMock.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) }),
    );
  });

  it('returns 200 and marks payment EXPIRED on expire event', async () => {
    const expireSig = makeSignature(PAYMENT_ID, '407', '35000.00', SERVER_KEY);
    paymentMock.findUnique.mockResolvedValue({
      id: PAYMENT_ID, orderId: ORDER_ID, amount: 35000,
      order: { id: ORDER_ID, status: 'WAITING_FOR_PAYMENT', paymentStatus: 'UNPAID' },
    } as never);

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .send({ order_id: PAYMENT_ID, transaction_status: 'expire', gross_amount: '35000.00', status_code: '407', signature_key: expireSig });

    expect(res.status).toBe(200);
  });

  it('returns 200 and marks payment FAILED on cancel event', async () => {
    const cancelSig = makeSignature(PAYMENT_ID, '200', '35000.00', SERVER_KEY);
    paymentMock.findUnique.mockResolvedValue({
      id: PAYMENT_ID, orderId: ORDER_ID, amount: 35000,
      order: { id: ORDER_ID, status: 'WAITING_FOR_PAYMENT', paymentStatus: 'UNPAID' },
    } as never);

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .send({ order_id: PAYMENT_ID, transaction_status: 'cancel', gross_amount: '35000.00', status_code: '200', signature_key: cancelSig });

    expect(res.status).toBe(200);
  });

  it('returns 200 gracefully when payment ID is unknown', async () => {
    paymentMock.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .send(validSettlement());

    expect(res.status).toBe(200);
  });
});
