jest.mock('@/application/database', () => {
  const orderMock = { findUnique: jest.fn(), update: jest.fn() };
  const paymentMock = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const deliveryMock = { create: jest.fn() };
  return {
    prisma: {
      order: orderMock,
      payment: paymentMock,
      delivery: deliveryMock,
      $transaction: jest.fn().mockImplementation(async (input: unknown) => {
        if (Array.isArray(input)) return Promise.all(input);
        return (input as Function)({
          order: orderMock,
          payment: paymentMock,
          delivery: deliveryMock,
        });
      }),
    },
  };
});

var mockCoreTransactionStatus: jest.Mock;

jest.mock('midtrans-client', () => {
  mockCoreTransactionStatus = jest.fn();
  return {
    Snap: jest.fn().mockImplementation(() => ({
      createTransaction: jest
        .fn()
        .mockResolvedValue({
          token: 'snap-token-abc',
          redirect_url: 'https://midtrans.test',
        }),
    })),
    CoreApi: jest.fn().mockImplementation(() => ({
      transaction: { status: mockCoreTransactionStatus },
    })),
  };
});

jest.mock('@/application/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma } from '@/application/database';
import { PaymentService } from '@/features/payments/payment-service';
import {
  makeOrder,
  makePayment,
  makeSignature,
  makeWebhookPayload,
  PAYMENT_FACTORY_IDS,
} from '../factories/payment.factory';

// ── Constants ─────────────────────────────────────────────────────────────────

const {
  CUSTOMER: CUSTOMER_ID,
  ORDER: ORDER_ID,
  PAYMENT: PAYMENT_ID,
} = PAYMENT_FACTORY_IDS;
const SNAP_TOKEN = 'snap-token-abc';
const SERVER_KEY = 'midtrans-server-key';

const orderMock = prisma.order as jest.Mocked<typeof prisma.order>;
const paymentMock = prisma.payment as jest.Mocked<typeof prisma.payment>;

beforeEach(() => {
  process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;
  process.env.MIDTRANS_CLIENT_KEY = 'client-key';
  process.env.MIDTRANS_IS_PRODUCTION = 'false';
  jest.clearAllMocks();
});

// ── initiatePayment ───────────────────────────────────────────────────────────

describe('PaymentService.initiatePayment', () => {
  it('creates a new Payment record and returns snapToken', async () => {
    orderMock.findUnique.mockResolvedValue(makeOrder() as never);
    paymentMock.create.mockResolvedValue(makePayment() as never);

    const result = await PaymentService.initiatePayment(CUSTOMER_ID, ORDER_ID);

    expect(result.snapToken).toBe(SNAP_TOKEN);
    expect(result.redirectUrl).toContain(SNAP_TOKEN);
    expect(paymentMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: expect.any(String),
          gateway: 'midtrans',
          status: 'PENDING',
        }),
      }),
    );
  });

  it('returns existing snapToken without calling Midtrans again (idempotency)', async () => {
    orderMock.findUnique.mockResolvedValue(
      makeOrder({ payment: makePayment() }) as never,
    );

    const result = await PaymentService.initiatePayment(CUSTOMER_ID, ORDER_ID);

    expect(result.snapToken).toBe(SNAP_TOKEN);
    expect(paymentMock.create).not.toHaveBeenCalled();
  });

  it('deletes expired payment and creates a fresh record on retry', async () => {
    orderMock.findUnique.mockResolvedValue(
      makeOrder({ payment: makePayment({ status: 'EXPIRED' }) }) as never,
    );
    paymentMock.create.mockResolvedValue(makePayment() as never);

    const result = await PaymentService.initiatePayment(CUSTOMER_ID, ORDER_ID);

    expect(paymentMock.delete).toHaveBeenCalledWith({
      where: { orderId: ORDER_ID },
    });
    expect(paymentMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: expect.any(String),
          status: 'PENDING',
        }),
      }),
    );
    expect(result.snapToken).toBe(SNAP_TOKEN);
  });

  it('throws 404 when order does not exist', async () => {
    orderMock.findUnique.mockResolvedValue(null);

    await expect(
      PaymentService.initiatePayment(CUSTOMER_ID, ORDER_ID),
    ).rejects.toMatchObject({ status: 404, message: 'Order not found' });
  });

  it('throws 403 when order belongs to a different customer', async () => {
    orderMock.findUnique.mockResolvedValue(
      makeOrder({ pickupRequest: { customerId: 'other-customer' } }) as never,
    );

    await expect(
      PaymentService.initiatePayment(CUSTOMER_ID, ORDER_ID),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('throws 409 when order is already paid', async () => {
    orderMock.findUnique.mockResolvedValue(
      makeOrder({ paymentStatus: 'PAID' }) as never,
    );

    await expect(
      PaymentService.initiatePayment(CUSTOMER_ID, ORDER_ID),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Order has already been paid',
    });
  });
});

// ── handleWebhook ─────────────────────────────────────────────────────────────

describe('PaymentService.handleWebhook', () => {
  it('throws 400 when signature is invalid', async () => {
    await expect(
      PaymentService.handleWebhook({
        ...makeWebhookPayload(PAYMENT_ID, 'settlement', SERVER_KEY),
        signature_key: 'bad-sig',
      }),
    ).rejects.toMatchObject({ status: 400, message: 'Invalid signature' });
  });

  it('settlement: marks payment PAID, order paymentStatus PAID, creates Delivery when WAITING_FOR_PAYMENT', async () => {
    paymentMock.findUnique.mockResolvedValue(
      makePayment({ order: makeOrder() }) as never,
    );

    await PaymentService.handleWebhook(
      makeWebhookPayload(PAYMENT_ID, 'settlement', SERVER_KEY),
    );

    expect(paymentMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID' }),
      }),
    );
    expect(orderMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: 'PAID' }),
      }),
    );
    expect(prisma.delivery.create).toHaveBeenCalled();
  });

  it('settlement with fraud_status deny: does not mark payment PAID', async () => {
    paymentMock.findUnique.mockResolvedValue(
      makePayment({ order: makeOrder() }) as never,
    );

    await PaymentService.handleWebhook({
      ...makeWebhookPayload(PAYMENT_ID, 'settlement', SERVER_KEY, '202'),
      fraud_status: 'deny',
    });

    expect(paymentMock.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID' }),
      }),
    );
    expect(prisma.delivery.create).not.toHaveBeenCalled();
  });

  it('settlement: skips Delivery creation when order status is not WAITING_FOR_PAYMENT', async () => {
    paymentMock.findUnique.mockResolvedValue(
      makePayment({
        order: makeOrder({ status: 'LAUNDRY_READY_FOR_DELIVERY' }),
      }) as never,
    );

    await PaymentService.handleWebhook(
      makeWebhookPayload(PAYMENT_ID, 'settlement', SERVER_KEY),
    );

    expect(prisma.delivery.create).not.toHaveBeenCalled();
  });

  it('expire: sets Payment status to EXPIRED', async () => {
    paymentMock.findUnique.mockResolvedValue(
      makePayment({ order: makeOrder() }) as never,
    );

    await PaymentService.handleWebhook(
      makeWebhookPayload(PAYMENT_ID, 'expire', SERVER_KEY, '407'),
    );

    expect(paymentMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'EXPIRED' } }),
    );
  });

  it('cancel: sets Payment status to FAILED', async () => {
    paymentMock.findUnique.mockResolvedValue(
      makePayment({ order: makeOrder() }) as never,
    );

    await PaymentService.handleWebhook(
      makeWebhookPayload(PAYMENT_ID, 'cancel', SERVER_KEY),
    );

    expect(paymentMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'FAILED' } }),
    );
  });

  it('deny: sets Payment status to FAILED', async () => {
    paymentMock.findUnique.mockResolvedValue(
      makePayment({ order: makeOrder() }) as never,
    );

    await PaymentService.handleWebhook(
      makeWebhookPayload(PAYMENT_ID, 'deny', SERVER_KEY),
    );

    expect(paymentMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'FAILED' } }),
    );
  });

  it('pending: performs no DB update', async () => {
    paymentMock.findUnique.mockResolvedValue(
      makePayment({ order: makeOrder() }) as never,
    );

    await PaymentService.handleWebhook(
      makeWebhookPayload(PAYMENT_ID, 'pending', SERVER_KEY),
    );

    expect(paymentMock.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns without error when payment ID is unknown (idempotent webhook handling)', async () => {
    paymentMock.findUnique.mockResolvedValue(null);

    await expect(
      PaymentService.handleWebhook(
        makeWebhookPayload(PAYMENT_ID, 'settlement', SERVER_KEY),
      ),
    ).resolves.toBeUndefined();
  });

  it('does not call processSettlement when payment is already PAID', async () => {
    paymentMock.findUnique.mockResolvedValue(
      makePayment({ status: 'PAID', order: makeOrder() }) as never,
    );

    await PaymentService.handleWebhook(
      makeWebhookPayload(PAYMENT_ID, 'settlement', SERVER_KEY),
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

// ── verifyPayment ─────────────────────────────────────────────────────────────

describe('PaymentService.verifyPayment', () => {
  it('returns void without any DB call when order is already PAID', async () => {
    orderMock.findUnique.mockResolvedValue(
      makeOrder({ paymentStatus: 'PAID' }) as never,
    );

    await expect(
      PaymentService.verifyPayment(CUSTOMER_ID, ORDER_ID),
    ).resolves.toBeUndefined();
    expect(mockCoreTransactionStatus).not.toHaveBeenCalled();
    expect(paymentMock.update).not.toHaveBeenCalled();
  });

  it('throws 404 when order does not exist', async () => {
    orderMock.findUnique.mockResolvedValue(null);

    await expect(
      PaymentService.verifyPayment(CUSTOMER_ID, ORDER_ID),
    ).rejects.toMatchObject({ status: 404, message: 'Order not found' });
  });

  it('throws 403 when order belongs to a different customer', async () => {
    orderMock.findUnique.mockResolvedValue(
      makeOrder({ pickupRequest: { customerId: 'other-customer' } }) as never,
    );

    await expect(
      PaymentService.verifyPayment(CUSTOMER_ID, ORDER_ID),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('throws 404 when no payment has been initiated', async () => {
    orderMock.findUnique.mockResolvedValue(
      makeOrder({ payment: null }) as never,
    );

    await expect(
      PaymentService.verifyPayment(CUSTOMER_ID, ORDER_ID),
    ).rejects.toMatchObject({
      status: 404,
      message: 'No payment initiated for this order',
    });
  });

  it('calls processSettlement when Midtrans returns settlement with non-deny fraud_status', async () => {
    orderMock.findUnique.mockResolvedValue(
      makeOrder({ payment: makePayment() }) as never,
    );
    mockCoreTransactionStatus.mockResolvedValue({
      transaction_status: 'settlement',
      fraud_status: 'accept',
    });

    await PaymentService.verifyPayment(CUSTOMER_ID, ORDER_ID);

    expect(paymentMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID' }),
      }),
    );
    expect(orderMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: 'PAID' }),
      }),
    );
  });

  it('does not call processSettlement when Midtrans returns settlement with fraud_status deny', async () => {
    orderMock.findUnique.mockResolvedValue(
      makeOrder({ payment: makePayment() }) as never,
    );
    mockCoreTransactionStatus.mockResolvedValue({
      transaction_status: 'settlement',
      fraud_status: 'deny',
    });

    await PaymentService.verifyPayment(CUSTOMER_ID, ORDER_ID);

    expect(paymentMock.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID' }),
      }),
    );
  });

  it('calls processFailure with EXPIRED when Midtrans returns expire', async () => {
    orderMock.findUnique.mockResolvedValue(
      makeOrder({ payment: makePayment() }) as never,
    );
    mockCoreTransactionStatus.mockResolvedValue({
      transaction_status: 'expire',
      fraud_status: 'accept',
    });

    await PaymentService.verifyPayment(CUSTOMER_ID, ORDER_ID);

    expect(paymentMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'EXPIRED' } }),
    );
  });

  it('calls processFailure with FAILED when Midtrans returns cancel', async () => {
    orderMock.findUnique.mockResolvedValue(
      makeOrder({ payment: makePayment() }) as never,
    );
    mockCoreTransactionStatus.mockResolvedValue({
      transaction_status: 'cancel',
      fraud_status: 'accept',
    });

    await PaymentService.verifyPayment(CUSTOMER_ID, ORDER_ID);

    expect(paymentMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'FAILED' } }),
    );
  });

  it('calls processFailure with FAILED when Midtrans returns deny', async () => {
    orderMock.findUnique.mockResolvedValue(
      makeOrder({ payment: makePayment() }) as never,
    );
    mockCoreTransactionStatus.mockResolvedValue({
      transaction_status: 'deny',
      fraud_status: 'deny',
    });

    await PaymentService.verifyPayment(CUSTOMER_ID, ORDER_ID);

    expect(paymentMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'FAILED' } }),
    );
  });

  it('makes no DB writes when Midtrans returns pending', async () => {
    orderMock.findUnique.mockResolvedValue(
      makeOrder({ payment: makePayment() }) as never,
    );
    mockCoreTransactionStatus.mockResolvedValue({
      transaction_status: 'pending',
      fraud_status: 'accept',
    });

    await PaymentService.verifyPayment(CUSTOMER_ID, ORDER_ID);

    expect(paymentMock.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
