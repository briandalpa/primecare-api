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
  const deliveryMock = { findFirst: jest.fn() };
  return {
    prisma: {
      pickupRequest: pickupRequestMock,
      address: addressMock,
      outlet: outletMock,
      delivery: deliveryMock,
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
        });
      }),
    },
  };
});

jest.mock('@/utils/haversine', () => ({
  haversineDistance: jest.fn(),
}));

import { PickupRequestService } from '@/features/pickup-requests/pickup-request-service';
import { ResponseError } from '@/error/response-error';
import { prisma } from '@/application/database';
import { haversineDistance } from '@/utils/haversine';
import { makeAddress, makeOutlet, makePickupRequest } from '../factories/pickup-request.factory';

const pickupRequestMock = prisma.pickupRequest as jest.Mocked<typeof prisma.pickupRequest>;
const addressMock = prisma.address as jest.Mocked<typeof prisma.address>;
const outletMock = prisma.outlet as jest.Mocked<typeof prisma.outlet>;
const deliveryMock = prisma.delivery as jest.Mocked<typeof prisma.delivery>;
const haversineDistanceMock = haversineDistance as unknown as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('PickupRequestService.createPickupRequest', () => {
  it('assigns nearest outlet within range', async () => {
    const customerId = '550e8400-e29b-41d4-a716-446655440000';
    const address = makeAddress({ userId: customerId });
    const outlet1 = makeOutlet({ latitude: -6.2607, longitude: 106.8143 });
    const outlet2UUID = '550e8400-e29b-41d4-a716-446655440094';
    const outlet2 = makeOutlet({ id: outlet2UUID, latitude: -6.3, longitude: 106.5 });

    addressMock.findUnique.mockResolvedValue(address as never);
    pickupRequestMock.findFirst.mockResolvedValue(null); // no duplicate
    outletMock.findMany.mockResolvedValue([outlet1, outlet2] as never);

    // Distance to outlet-1: 5km, distance to outlet-2: 15km
    haversineDistanceMock.mockImplementation((_lat1, _lon1, lat2, _lon2) => {
      if (lat2 === -6.2607) return 5; // outlet-1
      return 15; // outlet-2
    });

    pickupRequestMock.create.mockResolvedValue(makePickupRequest({ outlet: outlet1 }) as never);

    const result = await PickupRequestService.createPickupRequest(customerId, {
      addressId: address.id,
      scheduledAt: '2026-04-01T09:00:00Z',
    });

    expect(result.outlet.id).toBe(outlet1.id);
    expect(pickupRequestMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outletId: outlet1.id,
          customerId,
        }),
        include: { outlet: true },
      })
    );
  });

  it('throws 422 when no outlet is within range', async () => {
    const customerId = '550e8400-e29b-41d4-a716-446655440000';
    const address = makeAddress({ userId: customerId });
    const outlet = makeOutlet({ maxServiceRadiusKm: 10 });

    addressMock.findUnique.mockResolvedValue(address as never);
    pickupRequestMock.findFirst.mockResolvedValue(null);
    outletMock.findMany.mockResolvedValue([outlet] as never);
    haversineDistanceMock.mockReturnValue(50); // 50km away, exceeds 10km limit

    await expect(
      PickupRequestService.createPickupRequest(customerId, {
        addressId: address.id,
        scheduledAt: '2026-04-01T09:00:00Z',
      })
    ).rejects.toMatchObject({ status: 422, message: 'No outlet available in your area' });
  });

  it('throws 422 when only nearby outlet is inactive', async () => {
    const customerId = '550e8400-e29b-41d4-a716-446655440000';
    const address = makeAddress({ userId: customerId });

    addressMock.findUnique.mockResolvedValue(address as never);
    pickupRequestMock.findFirst.mockResolvedValue(null);
    outletMock.findMany.mockResolvedValue([]); // findMany with { isActive: true } returns empty

    await expect(
      PickupRequestService.createPickupRequest(customerId, {
        addressId: address.id,
        scheduledAt: '2026-04-01T09:00:00Z',
      })
    ).rejects.toMatchObject({ status: 422 });
  });

  it('throws 404 when addressId does not exist', async () => {
    addressMock.findUnique.mockResolvedValue(null);

    await expect(
      PickupRequestService.createPickupRequest('550e8400-e29b-41d4-a716-446655440000', {
        addressId: '550e8400-e29b-41d4-a716-446655440099',
        scheduledAt: '2026-04-01T09:00:00Z',
      })
    ).rejects.toMatchObject({ status: 404, message: 'Address not found' });
  });

  it('throws 403 when address belongs to another customer', async () => {
    const otherUserId = '550e8400-e29b-41d4-a716-446655440099';
    const address = makeAddress({ userId: otherUserId });
    addressMock.findUnique.mockResolvedValue(address as never);

    await expect(
      PickupRequestService.createPickupRequest('550e8400-e29b-41d4-a716-446655440000', {
        addressId: address.id,
        scheduledAt: '2026-04-01T09:00:00Z',
      })
    ).rejects.toMatchObject({ status: 403 });
  });

  it('throws 409 when duplicate pending request exists', async () => {
    const customerId = '550e8400-e29b-41d4-a716-446655440000';
    const address = makeAddress({ userId: customerId });
    const existingPickup = makePickupRequest({ customerId, addressId: address.id });

    addressMock.findUnique.mockResolvedValue(address as never);
    pickupRequestMock.findFirst.mockResolvedValue(existingPickup as never);

    await expect(
      PickupRequestService.createPickupRequest(customerId, {
        addressId: address.id,
        scheduledAt: '2026-04-01T09:00:00Z',
      })
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('PickupRequestService.listUnassignedRequests', () => {
  it('returns paginated data with correct metadata', async () => {
    const pickup1 = makePickupRequest();
    const pickup2 = makePickupRequest({ id: 'pickup-2' });

    pickupRequestMock.findMany.mockResolvedValue([
      { ...pickup1, address: makeAddress(), customerUser: { id: 'user-1', name: 'Test', phone: '+6281234567', email: '', emailVerified: false, image: null, avatarUrl: null, role: 'CUSTOMER', createdAt: new Date(), updatedAt: new Date() } },
      { ...pickup2, address: makeAddress({ id: 'addr-2' }), customerUser: { id: 'user-1', name: 'Test', phone: '+6281234567', email: '', emailVerified: false, image: null, avatarUrl: null, role: 'CUSTOMER', createdAt: new Date(), updatedAt: new Date() } },
    ] as never);

    pickupRequestMock.count.mockResolvedValue(25);

    const result = await PickupRequestService.listUnassignedRequests('outlet-1', { page: 1, limit: 10 });

    expect(result.data).toHaveLength(2);
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 25, totalPages: 3 });
  });

  it('filters by PENDING status and driverId null', async () => {
    pickupRequestMock.findMany.mockResolvedValue([]);
    pickupRequestMock.count.mockResolvedValue(0);

    await PickupRequestService.listUnassignedRequests('outlet-1', { page: 1, limit: 10 });

    expect(pickupRequestMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          outletId: 'outlet-1',
          status: 'PENDING',
          driverId: null,
        },
      })
    );
  });

  it('orders results by scheduledAt ASC', async () => {
    pickupRequestMock.findMany.mockResolvedValue([]);
    pickupRequestMock.count.mockResolvedValue(0);

    await PickupRequestService.listUnassignedRequests('outlet-1', { page: 1, limit: 10 });

    expect(pickupRequestMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { scheduledAt: 'asc' },
      })
    );
  });

  it('applies pagination with skip and take', async () => {
    pickupRequestMock.findMany.mockResolvedValue([]);
    pickupRequestMock.count.mockResolvedValue(0);

    await PickupRequestService.listUnassignedRequests('outlet-1', { page: 2, limit: 15 });

    expect(pickupRequestMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 15, // (2-1) * 15
        take: 15,
      })
    );
  });
});

describe('PickupRequestService.acceptPickupRequest', () => {
  const staffId = '550e8400-e29b-41d4-a716-446655440001';
  const pickupId = '550e8400-e29b-41d4-a716-446655440004';
  const outletId = '550e8400-e29b-41d4-a716-446655440002';

  it('accepts pickup request and assigns to driver', async () => {
    pickupRequestMock.findFirst.mockResolvedValueOnce(null); // no active pickup
    deliveryMock.findFirst.mockResolvedValueOnce(null); // no active delivery
    pickupRequestMock.update.mockResolvedValue(
      makePickupRequest({ status: 'DRIVER_ASSIGNED', driverId: staffId }) as never
    );

    const result = await PickupRequestService.acceptPickupRequest(staffId, pickupId, outletId);

    expect(result.driverId).toBe(staffId);
    expect(result.status).toBe('DRIVER_ASSIGNED');
  });

  it('throws 404 when pickup request not found or already assigned', async () => {
    pickupRequestMock.findFirst.mockResolvedValueOnce(null);
    deliveryMock.findFirst.mockResolvedValueOnce(null);
    pickupRequestMock.update.mockRejectedValue(new Error('An operation failed'));

    await expect(PickupRequestService.acceptPickupRequest(staffId, pickupId, outletId)).rejects.toMatchObject({
      status: 404,
      message: 'Pickup request not found or already assigned',
    });
  });

  it('throws 409 when driver has active pickup task', async () => {
    const activePickup = makePickupRequest({ status: 'DRIVER_ASSIGNED', driverId: staffId });
    pickupRequestMock.findFirst.mockResolvedValueOnce(activePickup as never);

    await expect(PickupRequestService.acceptPickupRequest(staffId, pickupId, outletId)).rejects.toMatchObject({
      status: 409,
      message: 'Driver already has an active task',
    });
  });

  it('throws 409 when driver has active delivery task', async () => {
    const activeDeliveryId = '550e8400-e29b-41d4-a716-446655440093';
    const activeDelivery = { id: activeDeliveryId, status: 'OUT_FOR_DELIVERY' };
    pickupRequestMock.findFirst.mockResolvedValueOnce(null);
    deliveryMock.findFirst.mockResolvedValueOnce(activeDelivery as never);

    await expect(PickupRequestService.acceptPickupRequest(staffId, pickupId, outletId)).rejects.toMatchObject({
      status: 409,
      message: 'Driver already has an active task',
    });
  });

  it('throws 403 when pickup request belongs to a different outlet', async () => {
    const differentOutletId = '550e8400-e29b-41d4-a716-446655440092';
    const pickup = makePickupRequest({ status: 'PENDING', outletId: differentOutletId, driverId: null });
    pickupRequestMock.findFirst.mockResolvedValueOnce(null);
    deliveryMock.findFirst.mockResolvedValueOnce(null);
    pickupRequestMock.update.mockResolvedValue(pickup as never);

    await expect(PickupRequestService.acceptPickupRequest(staffId, pickupId, outletId)).rejects.toMatchObject({
      status: 403,
      message: 'Pickup request belongs to a different outlet',
    });
  });
});
