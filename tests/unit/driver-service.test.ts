jest.mock('@/application/database', () => {
  const pickupRequestMock = { findFirst: jest.fn() };
  const deliveryMock = { findFirst: jest.fn() };
  return {
    prisma: {
      pickupRequest: pickupRequestMock,
      delivery: deliveryMock,
    },
  };
});

import { DriverService } from '@/features/driver/driver-service';
import { prisma } from '@/application/database';

const pickupRequestMock = prisma.pickupRequest as jest.Mocked<typeof prisma.pickupRequest>;
const deliveryMock = prisma.delivery as jest.Mocked<typeof prisma.delivery>;

const staffId = 'staff-uuid-0001';

const makePickupWithAddress = (overrides: object = {}) => ({
  id: 'pickup-uuid-0001',
  driverId: staffId,
  status: 'DRIVER_ASSIGNED',
  address: {
    id: 'address-uuid-0001',
    label: 'Home',
    street: 'Jl. Sudirman No. 1',
    city: 'Jakarta',
    province: 'DKI Jakarta',
    phone: '081234567890',
    latitude: -6.2,
    longitude: 106.8,
  },
  customerUser: {
    id: 'customer-uuid-0001',
    name: 'Budi Santoso',
    phone: '081234567890',
    email: 'budi@example.com',
  },
  ...overrides,
});

const makeDeliveryWithOrderChain = (overrides: object = {}) => ({
  id: 'delivery-uuid-0001',
  driverId: staffId,
  status: 'DRIVER_ASSIGNED',
  order: {
    id: 'order-uuid-0001',
    pickupRequest: {
      id: 'pickup-uuid-0001',
      address: {
        id: 'address-uuid-0001',
        label: 'Office',
        street: 'Jl. Thamrin No. 5',
        city: 'Jakarta',
        province: 'DKI Jakarta',
        phone: '089876543210',
        latitude: -6.2,
        longitude: 106.8,
      },
      customerUser: {
        id: 'customer-uuid-0001',
        name: 'Siti Rahayu',
        phone: '089876543210',
        email: 'siti@example.com',
      },
    },
  },
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe('DriverService.getActiveTask', () => {
  it('returns pickup task when active pickup (DRIVER_ASSIGNED) exists', async () => {
    const pickup = makePickupWithAddress();
    pickupRequestMock.findFirst.mockResolvedValue(pickup as never);

    const result = await DriverService.getActiveTask(staffId);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('pickup');
    expect(result!.id).toBe('pickup-uuid-0001');
    expect(result!.customerName).toBe('Budi Santoso');
    expect(result!.address.label).toBe('Home');
    expect(result!.address.city).toBe('Jakarta');
  });

  it('returns delivery task when no active pickup but active delivery exists', async () => {
    pickupRequestMock.findFirst.mockResolvedValue(null);
    const delivery = makeDeliveryWithOrderChain();
    deliveryMock.findFirst.mockResolvedValue(delivery as never);

    const result = await DriverService.getActiveTask(staffId);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('delivery');
    expect(result!.id).toBe('delivery-uuid-0001');
    expect(result!.customerName).toBe('Siti Rahayu');
    expect(result!.address.label).toBe('Office');
    expect((result as { type: 'delivery'; address: { province: string } }).address.province).toBe('DKI Jakarta');
  });

  it('returns null when neither pickup nor delivery is active', async () => {
    pickupRequestMock.findFirst.mockResolvedValue(null);
    deliveryMock.findFirst.mockResolvedValue(null);

    const result = await DriverService.getActiveTask(staffId);

    expect(result).toBeNull();
  });

  it('returns pickup when both active pickup and delivery exist (pickup takes priority)', async () => {
    const pickup = makePickupWithAddress();
    pickupRequestMock.findFirst.mockResolvedValue(pickup as never);
    const delivery = makeDeliveryWithOrderChain();
    deliveryMock.findFirst.mockResolvedValue(delivery as never);

    const result = await DriverService.getActiveTask(staffId);

    expect(result!.type).toBe('pickup');
    expect(deliveryMock.findFirst).not.toHaveBeenCalled();
  });
});
