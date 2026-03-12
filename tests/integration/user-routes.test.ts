import type { Request, Response } from 'express';

jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((headers: Record<string, string | string[] | undefined>) => headers),
  toNodeHandler: jest.fn(() => (_req: Request, res: Response) => res.json({ ok: true })),
}));

jest.mock('@/application/database', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    account: { findFirst: jest.fn(), create: jest.fn() },
    verification: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
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

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

import request from 'supertest';
import { app } from '@/application/app';
import { prisma } from '@/application/database';
import { sendEmail } from '@/utils/mailer';
import { auth } from '@/utils/auth';

describe('User Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/users/register', () => {
    it('should register new user successfully', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
        emailVerified: false,
      });
      (prisma.verification.deleteMany as jest.Mock).mockResolvedValue({});
      (prisma.verification.create as jest.Mock).mockResolvedValue({ token: 'verify-token' });
      (sendEmail as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/users/register')
        .send({ name: 'John Doe', email: 'john@example.com' });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.email).toBe('john@example.com');
    });

    it('should return 400 when name is empty', async () => {
      const response = await request(app)
        .post('/api/v1/users/register')
        .send({ name: '', email: 'john@example.com' });

      expect(response.status).toBe(400);
    });

    it('should return 400 when email is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/users/register')
        .send({ name: 'John', email: 'invalid-email' });

      expect(response.status).toBe(400);
    });

    it('should return 409 when email already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });

      const response = await request(app)
        .post('/api/v1/users/register')
        .send({ name: 'John', email: 'john@example.com' });

      expect(response.status).toBe(409);
    });
  });

  describe('POST /api/v1/users/set-password', () => {
    it('should set password successfully', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      (prisma.verification.findFirst as jest.Mock).mockResolvedValue({
        id: 'verify-1',
        expiresAt: futureDate,
      });
      (prisma.account.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.account.create as jest.Mock).mockResolvedValue({ id: 'account-1' });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'user-1',
        emailVerified: true,
      });
      (prisma.verification.delete as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/v1/users/set-password')
        .send({ token: 'verify-token', password: 'SecurePass123' });

      expect(response.status).toBe(200);
    });

    it('should return 400 when password is too short', async () => {
      const response = await request(app)
        .post('/api/v1/users/set-password')
        .send({ token: 'verify-token', password: 'short' });

      expect(response.status).toBe(400);
    });

    it('should return 400 when token is expired', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      (prisma.verification.findFirst as jest.Mock).mockResolvedValue({
        id: 'verify-1',
        expiresAt: pastDate,
      });

      const response = await request(app)
        .post('/api/v1/users/set-password')
        .send({ token: 'expired-token', password: 'SecurePass123' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/users/resend-verification', () => {
    it('should resend verification email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        emailVerified: false,
        email: 'john@example.com',
      });
      (prisma.verification.findFirst as jest.Mock).mockResolvedValue({ id: 'verify-1' });
      (prisma.verification.deleteMany as jest.Mock).mockResolvedValue({});
      (prisma.verification.create as jest.Mock).mockResolvedValue({ token: 'new-token' });
      (sendEmail as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/users/resend-verification')
        .send({ email: 'john@example.com' });

      expect(response.status).toBe(200);
    });

    it('should silently succeed for unknown email (security)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/users/resend-verification')
        .send({ email: 'unknown@example.com' });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/v1/users/me', () => {
    it('should return 401 when not authenticated', async () => {
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/v1/users/me');

      expect(response.status).toBe(401);
    });

    it('should return user profile when authenticated', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        emailVerified: true,
      };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app).get('/api/v1/users/me');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.role).toBe('CUSTOMER');
    });
  });
});
