jest.mock('@/application/database', () => ({
  prisma: {
    order:   { findMany: jest.fn() },
    payment: { update: jest.fn() },
  },
}));

jest.mock('@/application/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/utils/mailer', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

import cron from 'node-cron';
import { prisma } from '@/application/database';
import { sendEmail } from '@/utils/mailer';
import { startPaymentDeadlineJob } from '@/jobs/payment-deadline.job';

const orderMock    = prisma.order   as jest.Mocked<typeof prisma.order>;
const paymentMock  = prisma.payment as jest.Mocked<typeof prisma.payment>;
const sendEmailMock = sendEmail as jest.MockedFunction<typeof sendEmail>;

const PAYMENT_ID     = 'pay-id-001';
const ORDER_ID       = 'order-id-001';
const CUSTOMER_EMAIL = 'customer@test.com';
const CUSTOMER_NAME  = 'John Doe';

const makePackingOrder = (overrides: object = {}) => ({
  id: ORDER_ID,
  status: 'LAUNDRY_BEING_PACKED',
  payment: { id: PAYMENT_ID, reminderSentAt: null },
  pickupRequest: { customerUser: { email: CUSTOMER_EMAIL, name: CUSTOMER_NAME } },
  ...overrides,
});

const makeReminderOrder = (overrides: object = {}) => ({
  id: ORDER_ID,
  status: 'WAITING_FOR_PAYMENT',
  payment: { id: PAYMENT_ID },
  pickupRequest: { customerUser: { email: CUSTOMER_EMAIL, name: CUSTOMER_NAME } },
  ...overrides,
});

let cronExpression: string;
let cronCallback: () => Promise<void>;

beforeAll(() => {
  startPaymentDeadlineJob();
  const [expression, callback] = (cron.schedule as jest.Mock).mock.calls[0] as [string, () => Promise<void>];
  cronExpression = expression;
  cronCallback = callback;
});

beforeEach(() => {
  jest.clearAllMocks();
  sendEmailMock.mockResolvedValue(undefined);
  paymentMock.update.mockResolvedValue({} as never);
});

// ── Schedule registration ─────────────────────────────────────────────────────

it('registers cron on a 30-minute interval', () => {
  expect(cronExpression).toBe('*/30 * * * *');
});

// ── sendPackingHeadsUp ────────────────────────────────────────────────────────

describe('sendPackingHeadsUp', () => {
  it('sends packing heads-up email and updates reminderSentAt', async () => {
    orderMock.findMany
      .mockResolvedValueOnce([makePackingOrder()])
      .mockResolvedValueOnce([]);

    await cronCallback();

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: CUSTOMER_EMAIL, subject: expect.stringContaining('almost ready') })
    );
    expect(paymentMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PAYMENT_ID }, data: { reminderSentAt: expect.any(Date) } })
    );
  });

  it('swallows email failure and still updates reminderSentAt', async () => {
    orderMock.findMany
      .mockResolvedValueOnce([makePackingOrder()])
      .mockResolvedValueOnce([]);
    sendEmailMock.mockRejectedValueOnce(new Error('SMTP timeout'));

    await expect(cronCallback()).resolves.toBeUndefined();
    expect(paymentMock.update).toHaveBeenCalled();
  });

  it('skips notification when query returns no eligible orders', async () => {
    orderMock.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await cronCallback();

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(paymentMock.update).not.toHaveBeenCalled();
  });
});

// ── sendPaymentReminder ───────────────────────────────────────────────────────

describe('sendPaymentReminder', () => {
  it('sends payment reminder email and updates reminderSentAt', async () => {
    orderMock.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeReminderOrder()]);

    await cronCallback();

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: CUSTOMER_EMAIL, subject: expect.stringContaining('Action required') })
    );
    expect(paymentMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PAYMENT_ID }, data: { reminderSentAt: expect.any(Date) } })
    );
  });

  it('swallows email failure and still updates reminderSentAt', async () => {
    orderMock.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeReminderOrder()]);
    sendEmailMock.mockRejectedValueOnce(new Error('SMTP error'));

    await expect(cronCallback()).resolves.toBeUndefined();
    expect(paymentMock.update).toHaveBeenCalled();
  });

  it('skips notification when query returns no eligible orders', async () => {
    orderMock.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await cronCallback();

    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

// ── Job-level error handling ──────────────────────────────────────────────────

describe('cron callback error handling', () => {
  it('catches unexpected DB errors without throwing', async () => {
    orderMock.findMany.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(cronCallback()).resolves.toBeUndefined();
  });
});
