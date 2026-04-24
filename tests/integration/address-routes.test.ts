import type { Request, Response } from 'express';

jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((h: Record<string, string | string[] | undefined>) => h),
  toNodeHandler: jest.fn(() => (_req: Request, res: Response) => res.json({ ok: true })),
}));

jest.mock('@/application/database', () => {
  const addressMock = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  };
  const userMock = { findUnique: jest.fn() };
  const staffMock = { findUnique: jest.fn() };
  return {
    prisma: {
      address: addressMock,
      user: userMock,
      staff: staffMock,
      $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => unknown) =>
        cb({ address: addressMock })
      ),
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

const addr = prisma.address as jest.Mocked<typeof prisma.address>;
const userMock = prisma.user as jest.Mocked<typeof prisma.user>;
const staffMock = prisma.staff as jest.Mocked<typeof prisma.staff>;
const getSession = auth.api.getSession as unknown as jest.Mock;

const mockUser = { id: 'user-1', name: 'Test', email: 'test@example.com' };

const authenticatedAs = (u = mockUser) => {
  getSession.mockResolvedValue({ user: u });
  userMock.findUnique.mockResolvedValue(u as never);
  staffMock.findUnique.mockResolvedValue(null as never); // no Staff record = customer
};

const makeAddress = (overrides: object = {}) => ({
  id: 'addr-1',
  userId: 'user-1',
  label: 'Home',
  street: '1 Main St',
  city: 'Jakarta',
  province: 'DKI Jakarta',
  latitude: -6.2,
  longitude: 106.8,
  phone: '081234567890',
  isPrimary: true,
  createdAt: new Date(),
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe('GET /api/v1/users/addresses', () => {
  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/users/addresses');
    expect(res.status).toBe(401);
  });

  it('returns address list when authenticated', async () => {
    authenticatedAs();
    addr.findMany.mockResolvedValue([makeAddress()]);
    const res = await request(app).get('/api/v1/users/addresses');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].label).toBe('Home');
  });
});

describe('POST /api/v1/users/addresses', () => {
  const validBody = {
    label: 'Office',
    street: '2 Work Ave',
    city: 'Bandung',
    province: 'Jawa Barat',
    latitude: -6.9,
    longitude: 107.6,
    phone: '081298765432',
  };

  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).post('/api/v1/users/addresses').send(validBody);
    expect(res.status).toBe(401);
  });

  it('creates address and returns 201', async () => {
    authenticatedAs();
    addr.count.mockResolvedValue(1);
    addr.create.mockResolvedValue(makeAddress({ ...validBody, isPrimary: false }));
    const res = await request(app).post('/api/v1/users/addresses').send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
  });

  it('returns 400 when label is missing', async () => {
    authenticatedAs();
    const res = await request(app)
      .post('/api/v1/users/addresses')
      .send({ ...validBody, label: undefined });
    expect(res.status).toBe(400);
  });

  it('returns 400 when latitude is out of range', async () => {
    authenticatedAs();
    const res = await request(app)
      .post('/api/v1/users/addresses')
      .send({ ...validBody, latitude: 200 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when phone is missing', async () => {
    authenticatedAs();
    const { phone: _p, ...bodyWithoutPhone } = validBody;
    const res = await request(app)
      .post('/api/v1/users/addresses')
      .send(bodyWithoutPhone);
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/v1/users/addresses/:id', () => {
  it('returns 400 when only latitude is sent without longitude', async () => {
    authenticatedAs();
    const res = await request(app)
      .patch('/api/v1/users/addresses/addr-1')
      .send({ latitude: -6.2 });
    expect(res.status).toBe(400);
  });

  it('updates address and returns 200', async () => {
    authenticatedAs();
    addr.findUnique.mockResolvedValue(makeAddress() as never);
    addr.update.mockResolvedValue(makeAddress({ label: 'New Label' }) as never);
    const res = await request(app)
      .patch('/api/v1/users/addresses/addr-1')
      .send({ label: 'New Label' });
    expect(res.status).toBe(200);
    expect(res.body.data.label).toBe('New Label');
  });

  it('returns 404 when address does not exist', async () => {
    authenticatedAs();
    addr.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .patch('/api/v1/users/addresses/addr-x')
      .send({ label: 'X' });
    expect(res.status).toBe(404);
  });

  it('returns 403 when address belongs to another user', async () => {
    authenticatedAs();
    addr.findUnique.mockResolvedValue(makeAddress({ userId: 'other-user' }) as never);
    const res = await request(app)
      .patch('/api/v1/users/addresses/addr-1')
      .send({ label: 'X' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/users/addresses/:id', () => {
  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).delete('/api/v1/users/addresses/addr-1');
    expect(res.status).toBe(401);
  });

  it('deletes address and returns 204', async () => {
    authenticatedAs();
    addr.findUnique.mockResolvedValue(makeAddress({ isPrimary: false }) as never);
    addr.delete.mockResolvedValue({} as never);
    const res = await request(app).delete('/api/v1/users/addresses/addr-1');
    expect(res.status).toBe(204);
  });

  it('returns 404 when address does not exist', async () => {
    authenticatedAs();
    addr.findUnique.mockResolvedValue(null);
    const res = await request(app).delete('/api/v1/users/addresses/addr-x');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/users/addresses/:id/primary', () => {
  it('sets address as primary and returns 200', async () => {
    authenticatedAs();
    addr.findUnique.mockResolvedValue(makeAddress({ isPrimary: false }) as never);
    addr.updateMany.mockResolvedValue({ count: 1 } as never);
    addr.update.mockResolvedValue(makeAddress({ isPrimary: true }) as never);
    const res = await request(app).patch('/api/v1/users/addresses/addr-1/primary');
    expect(res.status).toBe(200);
    expect(res.body.data.isPrimary).toBe(true);
  });
});

describe('Address routes: staff access denied', () => {
  const staffRecord = { id: 'staff-1', userId: 'user-1', role: 'WORKER', isActive: true };

  it('returns 403 when a staff member calls GET /users/addresses', async () => {
    getSession.mockResolvedValue({ user: mockUser });
    userMock.findUnique.mockResolvedValue(mockUser as never);
    staffMock.findUnique.mockResolvedValue(staffRecord as never);
    const res = await request(app).get('/api/v1/users/addresses');
    expect(res.status).toBe(403);
  });

  it('returns 403 when a staff member calls POST /users/addresses', async () => {
    getSession.mockResolvedValue({ user: mockUser });
    userMock.findUnique.mockResolvedValue(mockUser as never);
    staffMock.findUnique.mockResolvedValue(staffRecord as never);
    const res = await request(app).post('/api/v1/users/addresses').send({
      label: 'Office', street: '2 Work Ave', city: 'Bandung', province: 'Jawa Barat',
      latitude: -6.9, longitude: 107.6, phone: '081298765432',
    });
    expect(res.status).toBe(403);
  });
});
