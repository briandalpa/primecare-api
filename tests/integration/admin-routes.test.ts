// Integration tests for admin routes — imports resolved via app.ts, no direct controller imports needed.
import type { Request, Response } from 'express';

jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((headers: Record<string, string | string[] | undefined>) => headers),
  toNodeHandler: jest.fn(() => (_req: Request, res: Response) => res.json({ ok: true })),
}));

jest.mock('@/application/database', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    staff: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
    verification: { create: jest.fn(), deleteMany: jest.fn() },
    order: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), count: jest.fn() },
    orderItem: { create: jest.fn() },
    pickupRequest: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/utils/mailer', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('@/utils/auth', () => ({
  auth: {
    api: { getSession: jest.fn() },
  },
}));

import request from 'supertest';
import { app } from '@/application/app';
import { prisma } from '@/application/database';
import { sendEmail } from '@/utils/mailer';
import { auth } from '@/utils/auth';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('Admin Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(
      (ops: Promise<unknown>[]) => Promise.all(ops)
    );
  });

  describe('GET /api/v1/admin/users', () => {
    it('should return 401 when not authenticated', async () => {
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/v1/admin/users');

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin roles', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'DRIVER', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app).get('/api/v1/admin/users');

      expect(response.status).toBe(403);
    });

    it('should return users for SUPER_ADMIN', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'user-2', name: 'Alice', email: 'alice@example.com', emailVerified: true, createdAt: new Date(), staff: { role: 'OUTLET_ADMIN', outletId: null, isActive: true, workerType: null } },
      ]);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/api/v1/admin/users');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toHaveProperty('total');
    });
  });

  describe('POST /api/v1/admin/users', () => {
    it('should return 401 when not authenticated', async () => {
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/admin/users')
        .send({ name: 'Charlie', email: 'charlie@example.com', role: 'OUTLET_ADMIN' });

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-SUPER_ADMIN', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'OUTLET_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app)
        .post('/api/v1/admin/users')
        .send({ name: 'Charlie', email: 'charlie@example.com', role: 'OUTLET_ADMIN' });

      expect(response.status).toBe(403);
    });

    it('should create OUTLET_ADMIN for SUPER_ADMIN', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);   // auth middleware
      (prisma.staff.findUnique as jest.Mock).mockResolvedValueOnce(mockStaff); // auth middleware
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);       // email uniqueness check
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'user-new',
        name: 'Charlie',
        email: 'charlie@example.com',
      });
      (prisma.staff.create as jest.Mock).mockResolvedValue({
        id: 'staff-new',
        userId: 'user-new',
        role: 'OUTLET_ADMIN',
      });
      (prisma.verification.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.verification.create as jest.Mock).mockResolvedValue({ token: 'invite-token' });
      (sendEmail as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/admin/users')
        .send({ name: 'Charlie', email: 'charlie@example.com', role: 'OUTLET_ADMIN' });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
    });

    it('should create WORKER with outletId and workerType', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);   // auth middleware
      (prisma.staff.findUnique as jest.Mock).mockResolvedValueOnce(mockStaff); // auth middleware
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);       // email uniqueness check
      (prisma.user.create as jest.Mock).mockResolvedValue({ id: 'user-w', name: 'Worker', email: 'worker@example.com' });
      (prisma.staff.create as jest.Mock).mockResolvedValue({ id: 'staff-w', role: 'WORKER' });
      (prisma.verification.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.verification.create as jest.Mock).mockResolvedValue({ token: 'token' });
      (sendEmail as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/admin/users')
        .send({ name: 'Worker', email: 'worker@example.com', role: 'WORKER', outletId: VALID_UUID, workerType: 'WASHING' });

      expect(response.status).toBe(201);
    });

    it('should return 400 for invalid input (empty name)', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app)
        .post('/api/v1/admin/users')
        .send({ name: '', email: 'charlie@example.com', role: 'OUTLET_ADMIN' });

      expect(response.status).toBe(400);
    });

    it('should return 400 for WORKER without outletId or workerType', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app)
        .post('/api/v1/admin/users')
        .send({ name: 'Worker', email: 'worker@example.com', role: 'WORKER' });

      expect(response.status).toBe(400);
    });

    it('should return 409 when email already exists', async () => {
      const mockUser = { id: 'user-1' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser });
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);   // auth middleware
      (prisma.staff.findUnique as jest.Mock).mockResolvedValueOnce(mockStaff); // auth middleware
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({            // email uniqueness check
        id: 'existing-user',
        email: 'charlie@example.com',
      });

      const response = await request(app)
        .post('/api/v1/admin/users')
        .send({
          name: 'Charlie',
          email: 'charlie@example.com',
          role: 'OUTLET_ADMIN',
        });

      expect(response.status).toBe(409);
    });
  });

  describe('PATCH /api/v1/admin/users/:id', () => {
    it('should return 403 for non-SUPER_ADMIN', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'OUTLET_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app)
        .patch('/api/v1/admin/users/user-2')
        .send({ role: 'DRIVER' });

      expect(response.status).toBe(403);
    });

    it('should update user for SUPER_ADMIN', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValueOnce(mockStaff);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'staff-2',
        userId: 'user-2',
        role: 'WORKER',
        outletId: null,
        isActive: true,
        workerType: 'WASHING',
      });
      (prisma.staff.update as jest.Mock).mockResolvedValue({
        id: 'staff-2',
        userId: 'user-2',
        role: 'OUTLET_ADMIN',
      });

      const response = await request(app)
        .patch('/api/v1/admin/users/user-2')
        .send({ role: 'OUTLET_ADMIN' });

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/v1/admin/users/:id', () => {
    it('should return 403 for non-SUPER_ADMIN', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'OUTLET_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app).delete('/api/v1/admin/users/user-2');

      expect(response.status).toBe(403);
    });

    it('should delete user for SUPER_ADMIN', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValueOnce(mockStaff);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'staff-2',
        userId: 'user-2',
      });
      (prisma.staff.delete as jest.Mock).mockResolvedValue({ id: 'staff-2' });
      (prisma.user.delete as jest.Mock).mockResolvedValue({ id: 'user-2' });

      const response = await request(app).delete('/api/v1/admin/users/user-2');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/v1/admin/orders', () => {
    it('should return 401 when unauthenticated', async () => {
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/v1/admin/orders');

      expect(response.status).toBe(401);
    });

    it('should return 403 for DRIVER role', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'DRIVER', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app).get('/api/v1/admin/orders');

      expect(response.status).toBe(403);
    });

    it('should return 200 with data array and meta for SUPER_ADMIN', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.order.findMany as jest.Mock).mockResolvedValue([{ id: 'order-1' }]);
      (prisma.order.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/api/v1/admin/orders');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toHaveProperty('total');
    });

    it('should return 200 for OUTLET_ADMIN with scoped result', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'OUTLET_ADMIN', outletId: 'outlet-1', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app).get('/api/v1/admin/orders');

      expect(response.status).toBe(200);
    });

    it('should return correct meta.page and meta.limit from query params', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app).get('/api/v1/admin/orders?page=2&limit=5');

      expect(response.status).toBe(200);
      expect(response.body.meta.page).toBe(2);
      expect(response.body.meta.limit).toBe(5);
    });
  });

  describe('GET /api/v1/admin/orders/:id', () => {
    it('should return 401 when unauthenticated', async () => {
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get(`/api/v1/admin/orders/${VALID_UUID}`);

      expect(response.status).toBe(401);
    });

    it('should return 200 with order data for SUPER_ADMIN', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({ id: VALID_UUID, outletId: 'outlet-1' });

      const response = await request(app).get(`/api/v1/admin/orders/${VALID_UUID}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('id', VALID_UUID);
    });

    it('should return 404 when order not found', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get(`/api/v1/admin/orders/${VALID_UUID}`);

      expect(response.status).toBe(404);
    });

    it('should return 403 when OUTLET_ADMIN accesses different outlet order', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'OUTLET_ADMIN', outletId: 'outlet-1', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({ id: VALID_UUID, outletId: 'outlet-other' });

      const response = await request(app).get(`/api/v1/admin/orders/${VALID_UUID}`);

      expect(response.status).toBe(403);
    });

    it('should return 200 when OUTLET_ADMIN accesses their own outlet order', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'OUTLET_ADMIN', outletId: 'outlet-1', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({ id: VALID_UUID, outletId: 'outlet-1' });

      const response = await request(app).get(`/api/v1/admin/orders/${VALID_UUID}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/v1/admin/pickup-requests', () => {
    it('should return 401 when unauthenticated', async () => {
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/v1/admin/pickup-requests');

      expect(response.status).toBe(401);
    });

    it('should return 403 for WORKER role', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'WORKER', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app).get('/api/v1/admin/pickup-requests');

      expect(response.status).toBe(403);
    });

    it('should return 200 with paginated data for SUPER_ADMIN', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.pickupRequest.findMany as jest.Mock).mockResolvedValue([{ id: 'pr-1' }]);
      (prisma.pickupRequest.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/api/v1/admin/pickup-requests');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toHaveProperty('total', 1);
    });

    it('should return 200 for OUTLET_ADMIN', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'OUTLET_ADMIN', outletId: 'outlet-1', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.pickupRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.pickupRequest.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app).get('/api/v1/admin/pickup-requests');

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/v1/admin/orders', () => {
    const validBody = {
      pickupRequestId: VALID_UUID,
      pricePerKg: 10000,
      totalWeightKg: 3,
      items: [{ laundryItemId: VALID_UUID, quantity: 2 }],
    };

    const mockPickup = {
      id: VALID_UUID,
      outletId: 'outlet-1',
      status: 'PICKED_UP',
      order: null,
      outlet: { latitude: -6.2, longitude: 106.8 },
      address: { latitude: -6.205, longitude: 106.805 },
    };

    it('should return 401 when unauthenticated', async () => {
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue(null);

      const response = await request(app).post('/api/v1/admin/orders').send(validBody);

      expect(response.status).toBe(401);
    });

    it('should return 403 for DRIVER role', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'DRIVER', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app).post('/api/v1/admin/orders').send(validBody);

      expect(response.status).toBe(403);
    });

    it('should return 400 for empty items array', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app)
        .post('/api/v1/admin/orders')
        .send({ ...validBody, items: [] });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing required fields', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app)
        .post('/api/v1/admin/orders')
        .send({ pickupRequestId: VALID_UUID });

      expect(response.status).toBe(400);
    });

    it('should return 201 on success for SUPER_ADMIN', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue(mockPickup);
      (prisma.order.create as jest.Mock).mockResolvedValue({ id: 'order-new', outletId: 'outlet-1' });
      (prisma.orderItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });

      const response = await request(app).post('/api/v1/admin/orders').send(validBody);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
    });

    it('should return 404 when pickupRequest not found', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).post('/api/v1/admin/orders').send(validBody);

      expect(response.status).toBe(404);
    });

    it('should return 409 when pickupRequest status is not PICKED_UP', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockPickup,
        status: 'DRIVER_ASSIGNED',
      });

      const response = await request(app).post('/api/v1/admin/orders').send(validBody);

      expect(response.status).toBe(409);
    });

    it('should return 409 when order already exists for pickup', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockPickup,
        order: { id: 'existing-order' },
      });

      const response = await request(app).post('/api/v1/admin/orders').send(validBody);

      expect(response.status).toBe(409);
    });

    it('should return 403 when OUTLET_ADMIN creates order for different outlet pickup', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'OUTLET_ADMIN', outletId: 'outlet-1', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockPickup,
        outletId: 'outlet-other',
      });

      const response = await request(app).post('/api/v1/admin/orders').send(validBody);

      expect(response.status).toBe(403);
    });

    it('should return 201 when OUTLET_ADMIN creates order for their own outlet pickup', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'OUTLET_ADMIN', outletId: 'outlet-1', isActive: true };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue(mockPickup);
      (prisma.order.create as jest.Mock).mockResolvedValue({ id: 'order-new', outletId: 'outlet-1' });
      (prisma.orderItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });

      const response = await request(app).post('/api/v1/admin/orders').send(validBody);

      expect(response.status).toBe(201);
    });
  });
});
