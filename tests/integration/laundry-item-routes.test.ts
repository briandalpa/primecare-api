import type { Request, Response } from 'express';

jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((headers: Record<string, string | string[] | undefined>) => headers),
  toNodeHandler: jest.fn(() => (_req: Request, res: Response) => res.json({ ok: true })),
}));

jest.mock('@/application/database', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    laundryItem: { findMany: jest.fn() },
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

describe('Laundry Item Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth.api.getSession as unknown as jest.Mock).mockResolvedValue(null);

    const response = await request(app).get('/api/v1/laundry-items');

    expect(response.status).toBe(401);
  });

  it('returns active laundry items for authenticated users', async () => {
    const mockUser = { id: 'user-1', email: 'john@example.com' };
    const mockItems = [{ id: '1', name: 'Shirt', slug: 'shirt' }];
    (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: 'token' });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.laundryItem.findMany as jest.Mock).mockResolvedValue(mockItems);

    const response = await request(app).get('/api/v1/laundry-items');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(mockItems);
  });
});
