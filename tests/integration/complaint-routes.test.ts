import type { Request, Response } from 'express';

jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((h: Record<string, string | string[] | undefined>) => h),
  toNodeHandler: jest.fn(() => (_req: Request, res: Response) => res.json({ ok: true })),
}));

jest.mock('@/application/database', () => {
  const complaintMock = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
  };
  const orderMock = { findFirst: jest.fn() };
  const userMock = { findUnique: jest.fn() };
  const staffMock = { findUnique: jest.fn() };
  return {
    prisma: {
      complaint: complaintMock,
      order: orderMock,
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
import {
  makeComplaint,
  makeComplaintOrder,
  makeComplaintCustomer,
  makeComplaintOutlet,
  COMPLAINT_IDS,
} from '../factories/complaint.factory';

const complaintMock = prisma.complaint as jest.Mocked<typeof prisma.complaint>;
const orderMock = prisma.order as jest.Mocked<typeof prisma.order>;
const userMock = prisma.user as jest.Mocked<typeof prisma.user>;
const staffMock = prisma.staff as jest.Mocked<typeof prisma.staff>;
const getSession = auth.api.getSession as unknown as jest.Mock;

const mockUser = {
  id: COMPLAINT_IDS.customerId,
  name: 'Budi Santoso',
  email: 'budi@example.com',
  phone: '081234567890',
};

const authenticatedAsCustomer = (u = mockUser) => {
  getSession.mockResolvedValue({ user: u });
  userMock.findUnique.mockResolvedValue(u as never);
  staffMock.findUnique.mockResolvedValue(null as never);
};

const authenticatedAsStaff = (role: string, outletId: string | null = COMPLAINT_IDS.outletId) => {
  getSession.mockResolvedValue({ user: mockUser });
  userMock.findUnique.mockResolvedValue(mockUser as never);
  staffMock.findUnique.mockResolvedValue({
    id: 'staff-uuid-001',
    userId: mockUser.id,
    role,
    outletId,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never);
};

const makeComplaintWithRelations = (overrides: object = {}) => ({
  ...makeComplaint(overrides),
  customer: makeComplaintCustomer(),
  order: makeComplaintOrder(),
});

const validCreateBody = {
  orderId: COMPLAINT_IDS.orderId,
  description: 'My laundry was damaged',
};

beforeEach(() => jest.clearAllMocks());

describe('POST /api/v1/complaints', () => {
  it('returns 201 when customer creates a valid complaint', async () => {
    authenticatedAsCustomer();
    orderMock.findFirst.mockResolvedValue(makeComplaintOrder({ status: 'LAUNDRY_DELIVERED_TO_CUSTOMER' }) as never);
    complaintMock.findFirst.mockResolvedValue(null);
    complaintMock.create.mockResolvedValue(makeComplaint() as never);

    const res = await request(app).post('/api/v1/complaints').send(validCreateBody);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.id).toBe(COMPLAINT_IDS.complaintId);
  });

  it('returns 401 when unauthenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).post('/api/v1/complaints').send(validCreateBody);
    expect(res.status).toBe(401);
  });

  it('returns 403 when staff calls (requireCustomerAuth blocks staff)', async () => {
    authenticatedAsStaff('OUTLET_ADMIN');
    const res = await request(app).post('/api/v1/complaints').send(validCreateBody);
    expect(res.status).toBe(403);
  });

  it('returns 400 when body is missing orderId', async () => {
    authenticatedAsCustomer();
    const { orderId: _o, ...bodyWithoutOrderId } = validCreateBody;
    const res = await request(app).post('/api/v1/complaints').send(bodyWithoutOrderId);
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is missing description', async () => {
    authenticatedAsCustomer();
    const { description: _d, ...bodyWithoutDescription } = validCreateBody;
    const res = await request(app).post('/api/v1/complaints').send(bodyWithoutDescription);
    expect(res.status).toBe(400);
  });

  it('returns 404 when order not found', async () => {
    authenticatedAsCustomer();
    orderMock.findFirst.mockResolvedValue(null);

    const res = await request(app).post('/api/v1/complaints').send(validCreateBody);
    expect(res.status).toBe(404);
  });

  it('returns 409 when order has wrong status', async () => {
    authenticatedAsCustomer();
    orderMock.findFirst.mockResolvedValue(makeComplaintOrder({ status: 'LAUNDRY_BEING_WASHED' }) as never);

    const res = await request(app).post('/api/v1/complaints').send(validCreateBody);
    expect(res.status).toBe(409);
  });

  it('returns 409 when complaint already exists for the order', async () => {
    authenticatedAsCustomer();
    orderMock.findFirst.mockResolvedValue(makeComplaintOrder({ status: 'LAUNDRY_DELIVERED_TO_CUSTOMER' }) as never);
    complaintMock.findFirst.mockResolvedValue(makeComplaint() as never);

    const res = await request(app).post('/api/v1/complaints').send(validCreateBody);
    expect(res.status).toBe(409);
  });
});

describe('GET /api/v1/complaints', () => {
  it('returns 200 with paginated list for customer', async () => {
    authenticatedAsCustomer();
    complaintMock.findMany.mockResolvedValue([makeComplaintWithRelations()] as never);
    complaintMock.count.mockResolvedValue(1);

    const res = await request(app).get('/api/v1/complaints');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toHaveProperty('total', 1);
  });

  it('returns 200 for OUTLET_ADMIN', async () => {
    authenticatedAsStaff('OUTLET_ADMIN');
    complaintMock.findMany.mockResolvedValue([makeComplaintWithRelations()] as never);
    complaintMock.count.mockResolvedValue(1);

    const res = await request(app).get('/api/v1/complaints');
    expect(res.status).toBe(200);
  });

  it('returns 200 for SUPER_ADMIN', async () => {
    authenticatedAsStaff('SUPER_ADMIN', null);
    complaintMock.findMany.mockResolvedValue([makeComplaintWithRelations()] as never);
    complaintMock.count.mockResolvedValue(1);

    const res = await request(app).get('/api/v1/complaints');
    expect(res.status).toBe(200);
  });

  it('returns 401 when unauthenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/complaints');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/complaints/:id', () => {
  it('returns 200 with complaint detail for owning customer', async () => {
    authenticatedAsCustomer();
    complaintMock.findUnique.mockResolvedValue(makeComplaintWithRelations() as never);

    const res = await request(app).get(`/api/v1/complaints/${COMPLAINT_IDS.complaintId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(COMPLAINT_IDS.complaintId);
  });

  it('returns 401 when unauthenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app).get(`/api/v1/complaints/${COMPLAINT_IDS.complaintId}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 when complaint not found', async () => {
    authenticatedAsCustomer();
    complaintMock.findUnique.mockResolvedValue(null);

    const res = await request(app).get(`/api/v1/complaints/${COMPLAINT_IDS.complaintId}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 when complaint belongs to different customer', async () => {
    authenticatedAsCustomer();
    complaintMock.findUnique.mockResolvedValue(
      makeComplaintWithRelations({ customerId: 'other-customer-uuid' }) as never
    );

    const res = await request(app).get(`/api/v1/complaints/${COMPLAINT_IDS.complaintId}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/complaints/:id/status', () => {
  it('returns 200 when OUTLET_ADMIN transitions status to IN_REVIEW', async () => {
    authenticatedAsStaff('OUTLET_ADMIN');
    const updatedAt = new Date();
    complaintMock.findUnique.mockResolvedValue({
      ...makeComplaint({ status: 'OPEN' }),
      order: makeComplaintOrder(),
    } as never);
    complaintMock.update.mockResolvedValue(makeComplaint({ status: 'IN_REVIEW', updatedAt }) as never);

    const res = await request(app)
      .patch(`/api/v1/complaints/${COMPLAINT_IDS.complaintId}/status`)
      .send({ status: 'IN_REVIEW' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_REVIEW');
  });

  it('returns 401 when unauthenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app)
      .patch(`/api/v1/complaints/${COMPLAINT_IDS.complaintId}/status`)
      .send({ status: 'IN_REVIEW' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when customer calls (requireStaffRole blocks customer)', async () => {
    authenticatedAsCustomer();
    const res = await request(app)
      .patch(`/api/v1/complaints/${COMPLAINT_IDS.complaintId}/status`)
      .send({ status: 'IN_REVIEW' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when status value is invalid', async () => {
    authenticatedAsStaff('OUTLET_ADMIN');
    const res = await request(app)
      .patch(`/api/v1/complaints/${COMPLAINT_IDS.complaintId}/status`)
      .send({ status: 'INVALID_STATUS' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when complaint not found', async () => {
    authenticatedAsStaff('OUTLET_ADMIN');
    complaintMock.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/v1/complaints/${COMPLAINT_IDS.complaintId}/status`)
      .send({ status: 'IN_REVIEW' });
    expect(res.status).toBe(404);
  });

  it('returns 409 when invalid status transition', async () => {
    authenticatedAsStaff('OUTLET_ADMIN');
    complaintMock.findUnique.mockResolvedValue({
      ...makeComplaint({ status: 'OPEN' }),
      order: makeComplaintOrder(),
    } as never);

    const res = await request(app)
      .patch(`/api/v1/complaints/${COMPLAINT_IDS.complaintId}/status`)
      .send({ status: 'RESOLVED' });
    expect(res.status).toBe(409);
  });
});
