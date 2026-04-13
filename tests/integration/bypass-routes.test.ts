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
    bypassRequest: { findFirst: jest.fn(), create: jest.fn() },
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
          bypassRequestId: bypassId,
          stationRecordId,
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
});
