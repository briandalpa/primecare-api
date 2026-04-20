import type { Request, Response } from 'express';

jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((h: Record<string, string | string[] | undefined>) => h),
  toNodeHandler: jest.fn(() => (_req: Request, res: Response) => res.json({ ok: true })),
}));

jest.mock('@/application/database', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('@/utils/auth', () => ({
  auth: { api: { getSession: jest.fn() } },
}));

jest.mock('@/utils/rajaongkir', () => ({
  RajaOngkirClient: {
    getProvinces: jest.fn(),
    getCities: jest.fn(),
  },
}));

jest.mock('@/utils/opencage', () => ({
  OpenCageClient: {
    geocode: jest.fn(),
    reverseGeocode: jest.fn(),
  },
}));

import request from 'supertest';
import { app } from '@/application/app';
import { prisma } from '@/application/database';
import { auth } from '@/utils/auth';
import { RajaOngkirClient } from '@/utils/rajaongkir';
import { OpenCageClient } from '@/utils/opencage';

const userMock = prisma.user as jest.Mocked<typeof prisma.user>;
const getSession = auth.api.getSession as unknown as jest.Mock;
const mockUser = { id: 'user-1', name: 'Test', email: 'test@example.com' };

const authenticatedAs = (u = mockUser) => {
  getSession.mockResolvedValue({ user: u });
  userMock.findUnique.mockResolvedValue(u as never);
};

beforeEach(() => jest.clearAllMocks());

describe('GET /api/v1/regions/provinces', () => {
  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/regions/provinces');
    expect(res.status).toBe(401);
  });

  it('returns provinces list', async () => {
    authenticatedAs();
    (RajaOngkirClient.getProvinces as jest.Mock).mockResolvedValue([
      { id: 1, name: 'DKI Jakarta' },
    ]);
    const res = await request(app).get('/api/v1/regions/provinces');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/v1/regions/cities/:provinceId', () => {
  it('returns 400 when provinceId is not a number', async () => {
    authenticatedAs();
    const res = await request(app).get('/api/v1/regions/cities/abc');
    expect(res.status).toBe(400);
  });

  it('returns cities for valid provinceId', async () => {
    authenticatedAs();
    (RajaOngkirClient.getCities as jest.Mock).mockResolvedValue([
      { id: 100, name: 'Jakarta Pusat', zipCode: '10110' },
    ]);
    const res = await request(app).get('/api/v1/regions/cities/1');
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toHaveProperty('zipCode');
  });
});

describe('GET /api/v1/regions/geocode', () => {
  it('returns 400 when city or province is missing', async () => {
    authenticatedAs();
    const res = await request(app).get('/api/v1/regions/geocode?city=Jakarta');
    expect(res.status).toBe(400);
  });

  it('returns coordinates for valid city and province', async () => {
    authenticatedAs();
    (OpenCageClient.geocode as jest.Mock).mockResolvedValue({ latitude: -6.2, longitude: 106.8 });
    const res = await request(app).get('/api/v1/regions/geocode?city=Jakarta&province=DKI+Jakarta');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('latitude');
    expect(res.body.data).toHaveProperty('longitude');
  });
});

describe('GET /api/v1/regions/reverse-geocode', () => {
  it('returns 401 when not authenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/regions/reverse-geocode?lat=-6.2&lng=106.8');
    expect(res.status).toBe(401);
  });

  it('returns 400 when lat or lng are missing', async () => {
    authenticatedAs();
    const res = await request(app).get('/api/v1/regions/reverse-geocode?lat=-6.2');
    expect(res.status).toBe(400);
  });

  it('returns 400 when lat is out of valid range', async () => {
    authenticatedAs();
    const res = await request(app).get('/api/v1/regions/reverse-geocode?lat=999&lng=106.8');
    expect(res.status).toBe(400);
  });

  it('returns 200 with ReverseGeocodeResult for valid coordinates', async () => {
    authenticatedAs();
    (OpenCageClient.reverseGeocode as jest.Mock).mockResolvedValue({
      province: 'DKI Jakarta', city: 'Jakarta Pusat', streetAddress: 'Jl. Sudirman',
    });
    (RajaOngkirClient.getProvinces as jest.Mock).mockResolvedValue([{ id: 6, name: 'DKI Jakarta' }]);
    (RajaOngkirClient.getCities   as jest.Mock).mockResolvedValue([{ id: 152, name: 'Jakarta Pusat', zipCode: '10110' }]);

    const res = await request(app).get('/api/v1/regions/reverse-geocode?lat=-6.2&lng=106.8');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toMatchObject({
      province: 'DKI Jakarta', provinceId: 6,
      city: 'Jakarta Pusat',   cityId: 152,
    });
  });

  it('returns 422 when area cannot be identified', async () => {
    authenticatedAs();
    (OpenCageClient.reverseGeocode as jest.Mock).mockResolvedValue({
      province: 'Unknown Province', city: 'Unknown City', streetAddress: null,
    });
    (RajaOngkirClient.getProvinces as jest.Mock).mockResolvedValue([{ id: 6, name: 'DKI Jakarta' }]);

    const res = await request(app).get('/api/v1/regions/reverse-geocode?lat=-6.2&lng=106.8');

    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Could not identify your area');
  });
});
