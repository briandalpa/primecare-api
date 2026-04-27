jest.mock('@/application/database', () => {
  const deliveryMock = {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  };
  const pickupRequestMock = { findFirst: jest.fn() };
  const orderMock = { update: jest.fn() };
  const orderItemMock = {};
  return {
    prisma: {
      delivery: deliveryMock,
      pickupRequest: pickupRequestMock,
      order: orderMock,
      orderItem: orderItemMock,
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

import { DeliveryService } from '@/features/deliveries/delivery-service';
import { ResponseError } from '@/error/response-error';
import { prisma } from '@/application/database';
import {
  makeDelivery,
  makeOrder,
  makePickupRequestForDelivery,
  makeDeliveryAddress,
  makeCustomerUser,
} from '../factories/delivery.factory';

const deliveryMock = prisma.delivery as jest.Mocked<typeof prisma.delivery>;
const pickupRequestMock = prisma.pickupRequest as jest.Mocked<typeof prisma.pickupRequest>;
const orderMock = prisma.order as jest.Mocked<typeof prisma.order>;

const outletId = '550e8400-e29b-41d4-a716-446655440002';
const staffId = '550e8400-e29b-41d4-a716-446655440001';
const deliveryId = '660e8400-e29b-41d4-a716-446655440010';

const makeDeliveryWithChain = (deliveryOverrides: object = {}, orderOverrides: object = {}) => {
  const address = makeDeliveryAddress();
  const customerUser = makeCustomerUser();
  const pickupRequest = { ...makePickupRequestForDelivery(), address, customerUser };
  const order = { ...makeOrder({ ...orderOverrides }), pickupRequest };
  return { ...makeDelivery({ ...deliveryOverrides }), order };
};

beforeEach(() => jest.clearAllMocks());

describe('DeliveryService.listDeliveries', () => {
  it('returns paginated deliveries with customer and address info', async () => {
    const delivery = makeDeliveryWithChain();

    deliveryMock.findMany.mockResolvedValue([delivery] as never);
    deliveryMock.count.mockResolvedValue(5);

    const result = await DeliveryService.listDeliveries(outletId, { page: 1, limit: 10, status: 'PENDING' as never });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.customer.name).toBe('John Doe');
    expect(result.data[0]!.deliveryAddress.label).toBe('Home');
    expect(result.meta).toEqual({ page: 1, limit: 10, total: 5, totalPages: 1 });
  });

  it('scopes query to outlet and paymentStatus PAID', async () => {
    deliveryMock.findMany.mockResolvedValue([]);
    deliveryMock.count.mockResolvedValue(0);

    await DeliveryService.listDeliveries(outletId, { page: 1, limit: 10, status: 'PENDING' as never });

    expect(deliveryMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          order: { outletId, paymentStatus: 'PAID' },
        }),
      })
    );
  });

  it('applies status filter from query', async () => {
    deliveryMock.findMany.mockResolvedValue([]);
    deliveryMock.count.mockResolvedValue(0);

    await DeliveryService.listDeliveries(outletId, { page: 1, limit: 10, status: 'DRIVER_ASSIGNED' as never });

    expect(deliveryMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'DRIVER_ASSIGNED' }),
      })
    );
  });

  it('applies pagination with skip and take', async () => {
    deliveryMock.findMany.mockResolvedValue([]);
    deliveryMock.count.mockResolvedValue(0);

    await DeliveryService.listDeliveries(outletId, { page: 3, limit: 5, status: 'PENDING' as never });

    expect(deliveryMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 })
    );
  });
});

describe('DeliveryService.acceptDelivery', () => {
  it('accepts delivery and advances order status', async () => {
    pickupRequestMock.findFirst.mockResolvedValueOnce(null);
    deliveryMock.findFirst.mockResolvedValueOnce(null);

    const updatedDelivery = {
      ...makeDelivery({ status: 'DRIVER_ASSIGNED', driverId: staffId }),
      order: makeOrder({ outletId }),
    };
    deliveryMock.update.mockResolvedValue(updatedDelivery as never);
    orderMock.update.mockResolvedValue({} as never);

    const result = await DeliveryService.acceptDelivery(staffId, deliveryId, outletId);

    expect(result.driverId).toBe(staffId);
    expect(result.status).toBe('DRIVER_ASSIGNED');
    expect(result.orderStatus).toBe('LAUNDRY_OUT_FOR_DELIVERY');
  });

  it('throws 409 when driver has active pickup task', async () => {
    const activePickup = { id: 'pickup-1', status: 'DRIVER_ASSIGNED', driverId: staffId };
    pickupRequestMock.findFirst.mockResolvedValueOnce(activePickup as never);

    await expect(
      DeliveryService.acceptDelivery(staffId, deliveryId, outletId)
    ).rejects.toMatchObject({ status: 409, message: 'Driver already has an active task' });
  });

  it('throws 409 when driver has active delivery task', async () => {
    pickupRequestMock.findFirst.mockResolvedValueOnce(null);
    const activeDelivery = { id: 'del-active', status: 'OUT_FOR_DELIVERY', driverId: staffId };
    deliveryMock.findFirst.mockResolvedValueOnce(activeDelivery as never);

    await expect(
      DeliveryService.acceptDelivery(staffId, deliveryId, outletId)
    ).rejects.toMatchObject({ status: 409 });
  });

  it('throws 404 when delivery not found or already assigned', async () => {
    pickupRequestMock.findFirst.mockResolvedValueOnce(null);
    deliveryMock.findFirst.mockResolvedValueOnce(null);
    deliveryMock.update.mockRejectedValue(new Error('Record not found'));

    await expect(
      DeliveryService.acceptDelivery(staffId, deliveryId, outletId)
    ).rejects.toMatchObject({ status: 404, message: 'Delivery not found' });
  });

  it('throws 403 when delivery belongs to a different outlet', async () => {
    const differentOutletId = '550e8400-e29b-41d4-a716-446655440099';
    pickupRequestMock.findFirst.mockResolvedValueOnce(null);
    deliveryMock.findFirst.mockResolvedValueOnce(null);

    const updatedDelivery = {
      ...makeDelivery({ status: 'DRIVER_ASSIGNED', driverId: staffId }),
      order: makeOrder({ outletId: differentOutletId }),
    };
    deliveryMock.update.mockResolvedValue(updatedDelivery as never);

    await expect(
      DeliveryService.acceptDelivery(staffId, deliveryId, outletId)
    ).rejects.toMatchObject({ status: 403, message: 'Delivery belongs to a different outlet' });
  });
});

describe('DeliveryService.completeDelivery', () => {
  it('marks delivery DELIVERED and updates order status', async () => {
    const delivery = makeDelivery({ id: deliveryId, status: 'DRIVER_ASSIGNED', driverId: staffId });
    deliveryMock.findFirst.mockResolvedValueOnce(delivery as never);

    const deliveredAt = new Date();
    const updatedDelivery = { ...delivery, status: 'DELIVERED', deliveredAt };
    deliveryMock.update.mockResolvedValue(updatedDelivery as never);
    orderMock.update.mockResolvedValue({} as never);

    const result = await DeliveryService.completeDelivery(staffId, deliveryId);

    expect(result.id).toBe(deliveryId);
    expect(result.status).toBe('DELIVERED');
    expect(result.deliveredAt).toBeDefined();
    expect(result.orderStatus).toBe('LAUNDRY_DELIVERED_TO_CUSTOMER');
    expect(deliveryMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DELIVERED' }),
      })
    );
  });

  it('throws 404 when delivery not found or not in DRIVER_ASSIGNED state', async () => {
    deliveryMock.findFirst.mockResolvedValueOnce(null);

    await expect(
      DeliveryService.completeDelivery(staffId, deliveryId)
    ).rejects.toMatchObject({ status: 404, message: 'Delivery not found or not in assigned state' });
  });

  it('throws 403 when caller is not the assigned driver', async () => {
    const otherDriverId = '550e8400-e29b-41d4-a716-446655440099';
    const delivery = makeDelivery({ id: deliveryId, status: 'DRIVER_ASSIGNED', driverId: otherDriverId });
    deliveryMock.findFirst.mockResolvedValueOnce(delivery as never);

    await expect(
      DeliveryService.completeDelivery(staffId, deliveryId)
    ).rejects.toMatchObject({ status: 403, message: 'You are not the assigned driver for this delivery' });
  });
});

describe('DeliveryService.listDriverHistory', () => {
  it('returns paginated DELIVERED deliveries with customer and address info', async () => {
    const delivery = makeDeliveryWithChain({ status: 'DELIVERED', driverId: staffId, deliveredAt: new Date() });

    deliveryMock.findMany.mockResolvedValue([delivery] as never);
    deliveryMock.count.mockResolvedValue(3);

    const result = await DeliveryService.listDriverHistory(staffId, {
      page: 1,
      limit: 10,
      sortBy: 'deliveredAt',
      order: 'desc',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.customer.name).toBe('John Doe');
    expect(result.data[0]!.deliveryAddress.city).toBe('Jakarta');
    expect(result.meta).toEqual({ page: 1, limit: 10, total: 3, totalPages: 1 });
  });

  it('filters by driverId and DELIVERED status', async () => {
    deliveryMock.findMany.mockResolvedValue([]);
    deliveryMock.count.mockResolvedValue(0);

    await DeliveryService.listDriverHistory(staffId, { page: 1, limit: 10, sortBy: 'deliveredAt', order: 'desc' });

    expect(deliveryMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ driverId: staffId, status: 'DELIVERED' }),
      })
    );
  });

  it('applies date range filter when fromDate/toDate provided', async () => {
    deliveryMock.findMany.mockResolvedValue([]);
    deliveryMock.count.mockResolvedValue(0);

    await DeliveryService.listDriverHistory(staffId, {
      page: 1,
      limit: 10,
      fromDate: '2026-01-01T00:00:00.000Z',
      toDate: '2026-04-01T00:00:00.000Z',
      sortBy: 'deliveredAt',
      order: 'desc',
    });

    expect(deliveryMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deliveredAt: {
            gte: new Date('2026-01-01T00:00:00.000Z'),
            lte: new Date('2026-04-01T00:00:00.000Z'),
          },
        }),
      })
    );
  });

  it('sorts by deliveredAt desc by default', async () => {
    deliveryMock.findMany.mockResolvedValue([]);
    deliveryMock.count.mockResolvedValue(0);

    await DeliveryService.listDriverHistory(staffId, { page: 1, limit: 10, sortBy: 'deliveredAt', order: 'desc' });

    expect(deliveryMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { deliveredAt: 'desc' } })
    );
  });
});

describe('DeliveryService.getOrderSummary', () => {
  const makeDeliveryWithOrderItems = (deliveryOverrides: object = {}) => ({
    ...makeDelivery(deliveryOverrides),
    order: {
      ...makeOrder(),
      items: [
        { id: 'item-1', quantity: 2, unitPrice: 5000, laundryItem: { id: 'li-1', name: 'Shirt' } },
        { id: 'item-2', quantity: 1, unitPrice: 8000, laundryItem: { id: 'li-2', name: 'Pants' } },
      ],
    },
  });

  it('returns order summary with items, subTotal, totalPrice, deliveryFee, paymentStatus', async () => {
    const delivery = makeDeliveryWithOrderItems({ driverId: staffId });
    deliveryMock.findFirst.mockResolvedValue(delivery as never);

    const result = await DeliveryService.getOrderSummary(staffId, deliveryId);

    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.name).toBe('Shirt');
    expect(result.totalPrice).toBe(delivery.order.totalPrice);
    expect(result.deliveryFee).toBe(delivery.order.deliveryFee);
    expect(result.subTotal).toBe(delivery.order.totalPrice - delivery.order.deliveryFee);
    expect(result.paymentStatus).toBe('PAID');
  });

  it('throws ResponseError(404) when delivery not found or not assigned to requesting driver', async () => {
    deliveryMock.findFirst.mockResolvedValue(null);

    await expect(
      DeliveryService.getOrderSummary(staffId, deliveryId)
    ).rejects.toMatchObject({ status: 404, message: 'Delivery not found' });
  });
});
