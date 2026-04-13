jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((headers: Record<string, string | string[] | undefined>) => headers),
  toNodeHandler: jest.fn(() => (_req: any, res: any) => res.json({ ok: true })),
}));

jest.mock('@/application/database', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    staff: { findUnique: jest.fn() },
    stationRecord: { findUnique: jest.fn(), update: jest.fn() },
    orderItem: { findMany: jest.fn() },
    stationItem: { deleteMany: jest.fn(), create: jest.fn() },
    bypassRequest: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/utils/auth', () => ({
  auth: {
    api: { getSession: jest.fn() },
  },
}));

import request from 'supertest';
import { app } from '@/application/app';
import { prisma } from '@/application/database';
import { auth } from '@/utils/auth';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('Bypass Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(
      (callback: (tx: any) => Promise<any>) =>
        callback({
          stationRecord: (prisma.stationRecord as any),
          orderItem: (prisma.orderItem as any),
          stationItem: (prisma.stationItem as any),
          bypassRequest: (prisma.bypassRequest as any),
        })
    );
  });

  const mockAuthenticatedWorker = (userId: string = 'user-1', staffId: string = 'staff-1') => {
    const mockUser = { id: userId, email: 'worker@example.com' };
    const mockStaff = { id: staffId, role: 'WORKER', isActive: true };

    (auth.api.getSession as jest.Mock).mockResolvedValue({
      user: mockUser,
      session: 'token',
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
  };

  const mockAuthenticatedAdmin = (
    userId = 'user-admin',
    staffId = 'staff-admin',
    outletId: string | null = 'outlet-1'
  ) => {
    const mockUser = { id: userId, email: 'admin@example.com' };
    const mockStaff = { id: staffId, role: 'OUTLET_ADMIN', isActive: true, outletId };

    (auth.api.getSession as jest.Mock).mockResolvedValue({
      user: mockUser,
      session: 'token',
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
  };

  describe('POST /api/v1/orders/:id/stations/:station/bypass', () => {
    it('returns 401 when not authenticated', async () => {
      (auth.api.getSession as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/v1/orders/${VALID_UUID}/stations/WASHING/bypass`)
        .send({ items: [{ laundryItemId: VALID_UUID, quantity: 5 }] });

      expect(response.status).toBe(401);
    });

    it('returns 403 for non-WORKER roles', async () => {
      const mockUser = { id: 'user-1', email: 'admin@example.com' };
      const mockStaff = { id: 'staff-1', role: 'OUTLET_ADMIN', isActive: true };

      (auth.api.getSession as jest.Mock).mockResolvedValue({
        user: mockUser,
        session: 'token',
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app)
        .post(`/api/v1/orders/${VALID_UUID}/stations/WASHING/bypass`)
        .send({ items: [{ laundryItemId: VALID_UUID, quantity: 5 }] });

      expect(response.status).toBe(403);
    });

    it('returns 400 for invalid request body (missing items)', async () => {
      mockAuthenticatedWorker();

      const response = await request(app)
        .post(`/api/v1/orders/${VALID_UUID}/stations/WASHING/bypass`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('returns 400 when quantities match (no mismatch)', async () => {
      mockAuthenticatedWorker('user-1', 'staff-1');
      const orderId = VALID_UUID;
      const stationRecordId = 'sr-1';

      (prisma.stationRecord as any).findUnique.mockResolvedValue({
        id: stationRecordId,
        orderId,
        station: 'WASHING',
        staffId: 'staff-1',
        status: 'IN_PROGRESS',
        stationItems: [],
      });

      (prisma.orderItem as any).findMany.mockResolvedValue([
        { laundryItemId: VALID_UUID, quantity: 5 },
      ]);

      const response = await request(app)
        .post(`/api/v1/orders/${orderId}/stations/WASHING/bypass`)
        .send({
          items: [{ laundryItemId: VALID_UUID, quantity: 5 }], // matches
        });

      expect(response.status).toBe(400);
    });

    it('returns 201 with proper envelope on valid mismatch', async () => {
      mockAuthenticatedWorker('user-1', 'staff-1');
      const orderId = VALID_UUID;
      const stationRecordId = 'sr-1';
      const bypassId = 'bp-1';

      (prisma.stationRecord as any).findUnique.mockResolvedValue({
        id: stationRecordId,
        orderId,
        station: 'WASHING',
        staffId: 'staff-1',
        status: 'IN_PROGRESS',
        stationItems: [],
      });

      (prisma.orderItem as any).findMany.mockResolvedValue([
        { laundryItemId: VALID_UUID, quantity: 5 },
      ]);

      (prisma.bypassRequest as any).findFirst.mockResolvedValue(null);
      (prisma.stationItem as any).deleteMany.mockResolvedValue({ count: 0 });
      (prisma.stationItem as any).create.mockResolvedValue({
        id: 'si-1',
        stationRecordId,
        laundryItemId: VALID_UUID,
        quantity: 3,
      });

      const now = new Date();
      (prisma.bypassRequest as any).create.mockResolvedValue({
        id: bypassId,
        stationRecordId,
        workerId: 'staff-1',
        adminId: null,
        problemDescription: null,
        status: 'PENDING',
        createdAt: now,
      });

      (prisma.stationRecord as any).update.mockResolvedValue({
        id: stationRecordId,
        status: 'BYPASS_REQUESTED',
      });

      const response = await request(app)
        .post(`/api/v1/orders/${orderId}/stations/WASHING/bypass`)
        .send({
          items: [{ laundryItemId: VALID_UUID, quantity: 3 }], // mismatch
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        status: 'success',
        message: 'Bypass request submitted. Awaiting admin approval.',
        data: {
          id: bypassId,
          status: 'PENDING',
          createdAt: now.toISOString(),
        },
      });
    });

    it('returns 404 when station record not found', async () => {
      mockAuthenticatedWorker();
      const orderId = VALID_UUID;

      (prisma.stationRecord as any).findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/v1/orders/${orderId}/stations/WASHING/bypass`)
        .send({
          items: [{ laundryItemId: VALID_UUID, quantity: 3 }],
        });

      expect(response.status).toBe(404);
    });

    it('rejects invalid station values', async () => {
      mockAuthenticatedWorker();
      const orderId = VALID_UUID;

      const response = await request(app)
        .post(`/api/v1/orders/${orderId}/stations/INVALID_STATION/bypass`)
        .send({
          items: [{ laundryItemId: VALID_UUID, quantity: 3 }],
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/bypass-requests', () => {
    const makeBypassRecord = () => ({
      id: 'bp-1',
      stationRecord: {
        station: 'IRONING',
        order: { id: 'ord-1', outletId: 'outlet-1' },
      },
      worker: { user: { name: 'Bob Ironing' } },
      admin: null,
      status: 'PENDING',
      createdAt: new Date('2026-03-07T11:00:00.000Z'),
      resolvedAt: null,
    });

    it('returns 401 when unauthenticated', async () => {
      (auth.api.getSession as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/v1/bypass-requests');

      expect(response.status).toBe(401);
    });

    it('returns 403 for WORKER role', async () => {
      mockAuthenticatedWorker();

      const response = await request(app).get('/api/v1/bypass-requests');

      expect(response.status).toBe(403);
    });

    it('returns 200 with paginated envelope for OUTLET_ADMIN', async () => {
      mockAuthenticatedAdmin();
      (prisma.bypassRequest.findMany as jest.Mock).mockResolvedValue([makeBypassRecord()]);
      (prisma.bypassRequest.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/api/v1/bypass-requests');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Bypass requests retrieved');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toMatchObject({ page: 1, limit: 10, total: 1, totalPages: 1 });
    });

    it('filters correctly when ?status=PENDING is provided', async () => {
      mockAuthenticatedAdmin();
      (prisma.bypassRequest.findMany as jest.Mock).mockResolvedValue([makeBypassRecord()]);
      (prisma.bypassRequest.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/bypass-requests')
        .query({ status: 'PENDING' });

      expect(response.status).toBe(200);
      expect(
        (prisma.bypassRequest.findMany as jest.Mock).mock.calls[0][0].where
      ).toMatchObject({ status: 'PENDING' });
    });

    it('returns 400 for invalid status value', async () => {
      mockAuthenticatedAdmin();

      const response = await request(app)
        .get('/api/v1/bypass-requests')
        .query({ status: 'INVALID_STATUS' });

      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid order value', async () => {
      mockAuthenticatedAdmin();

      const response = await request(app)
        .get('/api/v1/bypass-requests')
        .query({ order: 'INVALID_ORDER' });

      expect(response.status).toBe(400);
    });

    it('returns 200 for SUPER_ADMIN role', async () => {
      const mockUser = { id: 'user-super', email: 'super@example.com' };
      const mockStaff = { id: 'staff-super', role: 'SUPER_ADMIN', isActive: true, outletId: null };

      (auth.api.getSession as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.bypassRequest.findMany as jest.Mock).mockResolvedValue([makeBypassRecord()]);
      (prisma.bypassRequest.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/api/v1/bypass-requests');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });
  });
});
