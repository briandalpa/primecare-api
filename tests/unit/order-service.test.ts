jest.mock('@/application/database', () => {
  const txOrderMock = { findUnique: jest.fn(), update: jest.fn() };
  return {
    prisma: {
      $transaction: jest.fn().mockImplementation(async (cb: Function) =>
        cb({ order: txOrderMock })
      ),
      order: txOrderMock,
    },
  };
});

jest.mock('@/application/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma } from '@/application/database';
import { OrderService } from '@/features/orders/order-service';

const CUSTOMER_ID    = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_CUSTOMER = '550e8400-e29b-41d4-a716-446655440001';
const ORDER_ID       = '550e8400-e29b-41d4-a716-446655440010';

const txOrderMock = prisma.order as jest.Mocked<typeof prisma.order>;

const makeDeliveredOrder = (overrides: object = {}) => ({
  id:            ORDER_ID,
  status:        'LAUNDRY_DELIVERED_TO_CUSTOMER',
  confirmedAt:   null,
  pickupRequest: { customerId: CUSTOMER_ID },
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

// ── OrderService.confirmReceipt ───────────────────────────────────────────────

describe('OrderService.confirmReceipt', () => {
  it('sets status to COMPLETED and returns updated order', async () => {
    txOrderMock.findUnique.mockResolvedValue(makeDeliveredOrder() as never);
    txOrderMock.update.mockResolvedValue({
      id: ORDER_ID, status: 'COMPLETED', confirmedAt: new Date('2026-04-02T10:00:00.000Z'),
    } as never);

    const result = await OrderService.confirmReceipt(CUSTOMER_ID, ORDER_ID);

    expect(txOrderMock.update).toHaveBeenCalledWith({
      where: { id: ORDER_ID },
      data:  { status: 'COMPLETED', confirmedAt: expect.any(Date) },
    });
    expect(result.status).toBe('COMPLETED');
    expect(result.confirmedAt).toBeInstanceOf(Date);
  });

  it('throws 404 when order is not found', async () => {
    txOrderMock.findUnique.mockResolvedValue(null);

    await expect(OrderService.confirmReceipt(CUSTOMER_ID, ORDER_ID))
      .rejects.toMatchObject({ status: 404, message: 'Order not found' });
  });

  it('throws 404 when order belongs to a different customer', async () => {
    txOrderMock.findUnique.mockResolvedValue(
      makeDeliveredOrder({ pickupRequest: { customerId: OTHER_CUSTOMER } }) as never
    );

    await expect(OrderService.confirmReceipt(CUSTOMER_ID, ORDER_ID))
      .rejects.toMatchObject({ status: 404, message: 'Order not found' });
  });

  it('throws 409 when order is not in LAUNDRY_DELIVERED_TO_CUSTOMER status', async () => {
    txOrderMock.findUnique.mockResolvedValue(
      makeDeliveredOrder({ status: 'WAITING_FOR_PAYMENT' }) as never
    );

    await expect(OrderService.confirmReceipt(CUSTOMER_ID, ORDER_ID))
      .rejects.toMatchObject({ status: 409, message: 'Order cannot be confirmed at this stage' });
  });

  it('throws 409 when order is already COMPLETED', async () => {
    txOrderMock.findUnique.mockResolvedValue(
      makeDeliveredOrder({ status: 'COMPLETED' }) as never
    );

    await expect(OrderService.confirmReceipt(CUSTOMER_ID, ORDER_ID))
      .rejects.toMatchObject({ status: 409, message: 'Order cannot be confirmed at this stage' });
  });
});
