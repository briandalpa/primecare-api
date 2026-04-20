jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((headers: Record<string, string | string[] | undefined>) => headers),
  toNodeHandler: jest.fn(() => (_req: any, res: any) => res.json({ ok: true })),
}));

jest.mock('@/application/database', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    staff: { findUnique: jest.fn(), findFirst: jest.fn() },
    shift: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    stationRecord: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    orderItem: { findMany: jest.fn() },
    stationItem: { deleteMany: jest.fn(), createMany: jest.fn() },
    order: { update: jest.fn() },
    delivery: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/utils/auth', () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock('@/features/worker-notifications/worker-notification-service', () => ({ WorkerNotificationService: { publishOrderArrival: jest.fn() } }));

import request from 'supertest';
import { app } from '@/application/app';
import { prisma } from '@/application/database';
import { auth } from '@/utils/auth';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('Shift Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockResolvedValue([[], 0]);
  });

  const mockAdmin = (role: 'SUPER_ADMIN' | 'OUTLET_ADMIN' = 'OUTLET_ADMIN') => {
    const mockUser = { id: 'user-admin', email: 'admin@example.com' };
    const mockStaff = { id: 'staff-admin', role, isActive: true, outletId: 'outlet-1' };
    (auth.api.getSession as jest.Mock).mockResolvedValue({ user: mockUser, session: { id: 's', expiresAt: new Date() } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
  };

  const mockWorker = () => {
    const mockUser = { id: 'user-worker', email: 'worker@example.com' };
    const mockStaff = { id: 'staff-worker', role: 'WORKER', isActive: true, outletId: 'outlet-1', workerType: 'WASHING' };
    (auth.api.getSession as jest.Mock).mockResolvedValue({ user: mockUser, session: { id: 's', expiresAt: new Date() } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
  };

  it('creates a shift', async () => {
    mockAdmin();
    (prisma.staff.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'staff-admin', role: 'OUTLET_ADMIN', isActive: true, outletId: 'outlet-1' });
    (prisma.staff.findUnique as jest.Mock).mockResolvedValueOnce({
      id: VALID_UUID,
      role: 'WORKER',
      outletId: 'outlet-1',
      workerType: 'WASHING',
      user: { name: 'Wash Worker' },
      outlet: { id: 'outlet-1', name: 'Outlet A' },
    });
    (prisma.shift.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.shift.create as jest.Mock).mockResolvedValue({
      id: 'shift-1', staffId: VALID_UUID, startTime: new Date('2026-04-20T08:00:00.000Z'), endTime: null,
      staff: { workerType: 'WASHING', user: { name: 'Wash Worker' } }, outlet: { id: 'outlet-1', name: 'Outlet A' },
    });

    const response = await request(app).post('/api/v1/shifts').send({ staffId: VALID_UUID, startedAt: '2026-04-20T08:00:00.000Z' });

    expect(response.status).toBe(201);
    expect(response.body.data.isActive).toBe(true);
  });

  it('lists shifts with meta', async () => {
    mockAdmin('SUPER_ADMIN');
    (prisma.$transaction as jest.Mock).mockResolvedValue([[{
      id: 'shift-1', staffId: VALID_UUID, startTime: new Date('2026-04-20T08:00:00.000Z'), endTime: null,
      staff: { workerType: 'WASHING', user: { name: 'Wash Worker' } }, outlet: { id: 'outlet-1', name: 'Outlet A' },
    }], 1]);

    const response = await request(app).get('/api/v1/shifts').query({ isActive: true });

    expect(response.status).toBe(200);
    expect(response.body.meta.total).toBe(1);
  });

  it('ends a shift', async () => {
    mockAdmin();
    (prisma.shift.findUnique as jest.Mock).mockResolvedValue({
      id: VALID_UUID, outletId: 'outlet-1', staffId: 'worker-1', startTime: new Date('2026-04-20T08:00:00.000Z'), endTime: null,
      staff: { workerType: 'WASHING', user: { name: 'Wash Worker' } }, outlet: { id: 'outlet-1', name: 'Outlet A' },
    });
    (prisma.shift.update as jest.Mock).mockResolvedValue({
      id: VALID_UUID, outletId: 'outlet-1', staffId: 'worker-1', startTime: new Date('2026-04-20T08:00:00.000Z'), endTime: new Date('2026-04-20T17:00:00.000Z'),
      staff: { workerType: 'WASHING', user: { name: 'Wash Worker' } }, outlet: { id: 'outlet-1', name: 'Outlet A' },
    });

    const response = await request(app).patch(`/api/v1/shifts/${VALID_UUID}/end`);

    expect(response.status).toBe(200);
    expect(response.body.data.isActive).toBe(false);
  });

  it('blocks worker processing when no active shift exists', async () => {
    mockWorker();
    (prisma.shift.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await request(app)
      .post(`/api/v1/worker/orders/${VALID_UUID}/process`)
      .send({ items: [{ laundryItemId: VALID_UUID, quantity: 1 }] });

    expect(response.status).toBe(403);
    expect(response.body.errors).toBe('Worker is not on an active shift');
  });
});