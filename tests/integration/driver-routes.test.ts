import type { Request, Response } from 'express';

jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((h: Record<string, string | string[] | undefined>) => h),
  toNodeHandler: jest.fn(() => (_req: Request, res: Response) => res.json({ ok: true })),
}));

jest.mock('@/application/database', () => {
  const pickupRequestMock = { findFirst: jest.fn() };
  const deliveryMock = { findFirst: jest.fn() };
  const userMock = { findUnique: jest.fn() };
  const staffMock = { findUnique: jest.fn() };
  return {
    prisma: {
      pickupRequest: pickupRequestMock,
      delivery: deliveryMock,
      user: userMock,
      staff: staffMock,
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

const pickupRequestMock = prisma.pickupRequest as jest.Mocked<typeof prisma.pickupRequest>;
const deliveryMock = prisma.delivery as jest.Mocked<typeof prisma.delivery>;
const userMock = prisma.user as jest.Mocked<typeof prisma.user>;
const staffMock = prisma.staff as jest.Mocked<typeof prisma.staff>;
const getSession = auth.api.getSession as unknown as jest.Mock;

const mockUser = {
  id: 'user-uuid-0001',
  name: 'Driver Name',
  email: 'driver@example.com',
  phone: '081111111111',
};

const mockDriverStaff = {
  id: 'staff-uuid-0001',
  userId: mockUser.id,
  role: 'DRIVER',
  outletId: 'outlet-uuid-0001',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const authenticatedAsDriver = () => {
  getSession.mockResolvedValue({ user: mockUser });
  userMock.findUnique.mockResolvedValue(mockUser as never);
  staffMock.findUnique.mockResolvedValue(mockDriverStaff as never);
};

const authenticatedAsCustomer = () => {
  getSession.mockResolvedValue({ user: mockUser });
  userMock.findUnique.mockResolvedValue(mockUser as never);
  staffMock.findUnique.mockResolvedValue(null as never);
};

const authenticatedAsStaff = (role: string) => {
  getSession.mockResolvedValue({ user: mockUser });
  userMock.findUnique.mockResolvedValue(mockUser as never);
  staffMock.findUnique.mockResolvedValue({ ...mockDriverStaff, role } as never);
};

const makeActivePickup = () => ({
  id: 'pickup-uuid-0001',
  driverId: mockDriverStaff.id,
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
});

const makeActiveDelivery = () => ({
  id: 'delivery-uuid-0001',
  driverId: mockDriverStaff.id,
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
});

beforeEach(() => jest.clearAllMocks());

describe('GET /api/v1/drivers/me/active-task', () => {
  it('returns 200 with pickup task when active pickup exists', async () => {
    authenticatedAsDriver();
    pickupRequestMock.findFirst.mockResolvedValue(makeActivePickup() as never);

    const res = await request(app).get('/api/v1/drivers/me/active-task');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.type).toBe('pickup');
    expect(res.body.data.id).toBe('pickup-uuid-0001');
    expect(res.body.data).toHaveProperty('customerName', 'Budi Santoso');
    expect(res.body.data.address).toHaveProperty('label', 'Home');
  });

  it('returns 200 with delivery task when no active pickup but active delivery exists', async () => {
    authenticatedAsDriver();
    pickupRequestMock.findFirst.mockResolvedValue(null);
    deliveryMock.findFirst.mockResolvedValue(makeActiveDelivery() as never);

    const res = await request(app).get('/api/v1/drivers/me/active-task');

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('delivery');
    expect(res.body.data.id).toBe('delivery-uuid-0001');
    expect(res.body.data.customerName).toBe('Siti Rahayu');
    expect(res.body.data.address).toHaveProperty('label', 'Office');
    expect(res.body.data.address).toHaveProperty('province', 'DKI Jakarta');
  });

  it('returns 200 with null data when no active task', async () => {
    authenticatedAsDriver();
    pickupRequestMock.findFirst.mockResolvedValue(null);
    deliveryMock.findFirst.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/drivers/me/active-task');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('returns 401 when unauthenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/drivers/me/active-task');
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated as customer', async () => {
    authenticatedAsCustomer();
    const res = await request(app).get('/api/v1/drivers/me/active-task');
    expect(res.status).toBe(403);
  });

  it('returns 403 when authenticated as WORKER (not DRIVER)', async () => {
    authenticatedAsStaff('WORKER');
    const res = await request(app).get('/api/v1/drivers/me/active-task');
    expect(res.status).toBe(403);
  });
});
