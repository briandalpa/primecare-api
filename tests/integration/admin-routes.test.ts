jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((headers) => headers),
  toNodeHandler: jest.fn((auth) => (req, res) => res.json({ ok: true })),
}));

jest.mock('@/application/database', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
    staff: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
    verification: { create: jest.fn() },
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

describe('Admin Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/admin/users', () => {
    it('should return 401 when not authenticated', async () => {
      (auth.api.getSession as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/v1/admin/users');

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin roles', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'DRIVER', isActive: true };
      (auth.api.getSession as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app).get('/api/v1/admin/users');

      expect(response.status).toBe(403);
    });

    it('should return users for SUPER_ADMIN', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.staff.findMany as jest.Mock).mockResolvedValue([
        { id: 'staff-2', userId: 'user-2', role: 'OUTLET_ADMIN' },
      ]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'user-2', name: 'Alice', email: 'alice@example.com' },
      ]);

      const response = await request(app).get('/api/v1/admin/users');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/admin/users', () => {
    it('should return 401 when not authenticated', async () => {
      (auth.api.getSession as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/admin/users')
        .send({ name: 'Charlie', email: 'charlie@example.com', role: 'OUTLET_ADMIN' });

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-SUPER_ADMIN', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'OUTLET_ADMIN', isActive: true };
      (auth.api.getSession as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app)
        .post('/api/v1/admin/users')
        .send({ name: 'Charlie', email: 'charlie@example.com', role: 'WORKER' });

      expect(response.status).toBe(403);
    });

    it('should create admin user for SUPER_ADMIN', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValueOnce(mockStaff);
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'user-new',
        name: 'Charlie',
        email: 'charlie@example.com',
      });
      (prisma.staff.create as jest.Mock).mockResolvedValue({
        id: 'staff-new',
        userId: 'user-new',
        role: 'WORKER',
      });
      (prisma.verification.create as jest.Mock).mockResolvedValue({ token: 'invite-token' });
      (sendEmail as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/admin/users')
        .send({ name: 'Charlie', email: 'charlie@example.com', role: 'WORKER' });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
    });

    it('should return 400 for invalid input', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app)
        .post('/api/v1/admin/users')
        .send({ name: '', email: 'charlie@example.com', role: 'WORKER' });

      expect(response.status).toBe(400);
    });

    it('should return 409 when email already exists', async () => {
      const mockUser = { id: 'user-1' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as jest.Mock).mockResolvedValue({ user: mockUser });
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-user',
        email: 'charlie@example.com',
      });

      const response = await request(app)
        .post('/api/v1/admin/users')
        .send({
          name: 'Charlie',
          email: 'charlie@example.com',
          role: 'WORKER',
        });

      expect(response.status).toBe(409);
    });
  });

  describe('PATCH /api/v1/admin/users/:id', () => {
    it('should return 403 for non-SUPER_ADMIN', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'OUTLET_ADMIN', isActive: true };
      (auth.api.getSession as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
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
      (auth.api.getSession as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValueOnce(mockStaff);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'staff-2',
        userId: 'user-2',
        role: 'WORKER',
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
      (auth.api.getSession as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app).delete('/api/v1/admin/users/user-2');

      expect(response.status).toBe(403);
    });

    it('should delete user for SUPER_ADMIN', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockStaff = { id: 'staff-1', role: 'SUPER_ADMIN', isActive: true };
      (auth.api.getSession as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
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
});
