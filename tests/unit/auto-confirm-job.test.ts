jest.mock('@/application/database', () => ({
  prisma: {
    order: { updateMany: jest.fn() },
  },
}));

jest.mock('@/application/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

import cron from 'node-cron';
import { prisma } from '@/application/database';
import { logger } from '@/application/logging';
import { startAutoConfirmJob } from '@/jobs/auto-confirm.job';

const orderMock  = prisma.order  as jest.Mocked<typeof prisma.order>;
const loggerMock = logger as jest.Mocked<typeof logger>;

let cronExpression: string;
let cronCallback: () => Promise<void>;

beforeAll(() => {
  startAutoConfirmJob();
  const [expression, callback] = (cron.schedule as jest.Mock).mock.calls[0] as [string, () => Promise<void>];
  cronExpression = expression;
  cronCallback   = callback;
});

beforeEach(() => {
  jest.clearAllMocks();
  orderMock.updateMany.mockResolvedValue({ count: 0 });
});

// ── Schedule registration ─────────────────────────────────────────────────────

it('registers cron on a 15-minute interval', () => {
  expect(cronExpression).toBe('*/15 * * * *');
});

// ── runAutoConfirm ────────────────────────────────────────────────────────────

describe('runAutoConfirm', () => {
  it('calls updateMany with LAUNDRY_DELIVERED_TO_CUSTOMER and 48h threshold', async () => {
    const before = Date.now();
    await cronCallback();
    const after = Date.now();

    expect(orderMock.updateMany).toHaveBeenCalledWith({
      where: {
        status:    'LAUNDRY_DELIVERED_TO_CUSTOMER',
        updatedAt: { lte: expect.any(Date) },
      },
      data: { status: 'COMPLETED', confirmedAt: expect.any(Date) },
    });

    const calledThreshold: Date = (orderMock.updateMany.mock.calls[0] as [{ where: { updatedAt: { lte: Date } } }])[0].where.updatedAt.lte;
    const expectedMs = 48 * 60 * 60 * 1000;
    expect(before - calledThreshold.getTime()).toBeGreaterThanOrEqual(expectedMs - 100);
    expect(after  - calledThreshold.getTime()).toBeLessThanOrEqual(expectedMs + 100);
  });

  it('logs the count when orders are auto-confirmed', async () => {
    orderMock.updateMany.mockResolvedValue({ count: 3 });

    await cronCallback();

    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('3'));
  });

  it('does not log a count message when no orders are eligible', async () => {
    orderMock.updateMany.mockResolvedValue({ count: 0 });

    await cronCallback();

    const countLog = loggerMock.info.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('order')
    );
    expect(countLog).toBeUndefined();
  });

  it('swallows DB errors without throwing', async () => {
    orderMock.updateMany.mockRejectedValue(new Error('DB connection lost'));

    await expect(cronCallback()).resolves.toBeUndefined();
    expect(loggerMock.error).toHaveBeenCalled();
  });
});
