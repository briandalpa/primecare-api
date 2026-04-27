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
  return {
    prisma: {
      complaint: complaintMock,
      order: orderMock,
    },
  };
});

import { ComplaintService } from '@/features/complaints/complaint-service';
import { ResponseError } from '@/error/response-error';
import { prisma } from '@/application/database';
import {
  makeComplaint,
  makeComplaintOrder,
  makeComplaintCustomer,
  COMPLAINT_IDS,
} from '../factories/complaint.factory';

const complaintMock = prisma.complaint as jest.Mocked<typeof prisma.complaint>;
const orderMock = prisma.order as jest.Mocked<typeof prisma.order>;

const defaultQuery = { page: 1, limit: 10, sortBy: 'createdAt' as const, order: 'desc' as const };

const makeComplaintWithRelations = (overrides: object = {}) => {
  const customer = makeComplaintCustomer();
  const order = makeComplaintOrder();
  return { ...makeComplaint(overrides), customer, order };
};

beforeEach(() => jest.clearAllMocks());

describe('ComplaintService.create', () => {
  it('creates complaint when order is LAUNDRY_DELIVERED_TO_CUSTOMER with no existing complaint', async () => {
    orderMock.findFirst.mockResolvedValue(makeComplaintOrder({ status: 'LAUNDRY_DELIVERED_TO_CUSTOMER' }) as never);
    complaintMock.findFirst.mockResolvedValue(null);
    complaintMock.create.mockResolvedValue(makeComplaint() as never);

    const result = await ComplaintService.create(COMPLAINT_IDS.customerId, {
      orderId: COMPLAINT_IDS.orderId,
      description: 'My laundry was damaged',
    });

    expect(result.id).toBe(COMPLAINT_IDS.complaintId);
    expect(result.status).toBe('OPEN');
  });

  it('creates complaint when order is COMPLETED', async () => {
    orderMock.findFirst.mockResolvedValue(makeComplaintOrder({ status: 'COMPLETED' }) as never);
    complaintMock.findFirst.mockResolvedValue(null);
    complaintMock.create.mockResolvedValue(makeComplaint() as never);

    const result = await ComplaintService.create(COMPLAINT_IDS.customerId, {
      orderId: COMPLAINT_IDS.orderId,
      description: 'My laundry was damaged',
    });

    expect(result.orderId).toBe(COMPLAINT_IDS.orderId);
  });

  it('throws ResponseError(404) when order not found', async () => {
    orderMock.findFirst.mockResolvedValue(null);

    await expect(
      ComplaintService.create(COMPLAINT_IDS.customerId, { orderId: COMPLAINT_IDS.orderId, description: 'desc' })
    ).rejects.toMatchObject({ status: 404, message: 'Order not found' });
  });

  it('throws ResponseError(409) when order is ineligible status', async () => {
    orderMock.findFirst.mockResolvedValue(makeComplaintOrder({ status: 'LAUNDRY_BEING_WASHED' }) as never);

    await expect(
      ComplaintService.create(COMPLAINT_IDS.customerId, { orderId: COMPLAINT_IDS.orderId, description: 'desc' })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('throws ResponseError(409) when complaint already exists for the order', async () => {
    orderMock.findFirst.mockResolvedValue(makeComplaintOrder({ status: 'LAUNDRY_DELIVERED_TO_CUSTOMER' }) as never);
    complaintMock.findFirst.mockResolvedValue(makeComplaint() as never);

    await expect(
      ComplaintService.create(COMPLAINT_IDS.customerId, { orderId: COMPLAINT_IDS.orderId, description: 'desc' })
    ).rejects.toMatchObject({ status: 409, message: 'A complaint already exists for this order' });
  });
});

describe('ComplaintService.list', () => {
  it('filters by customerId when role is undefined (customer)', async () => {
    complaintMock.findMany.mockResolvedValue([makeComplaintWithRelations()] as never);
    complaintMock.count.mockResolvedValue(1);

    const result = await ComplaintService.list(undefined, COMPLAINT_IDS.customerId, null, defaultQuery);

    expect(result.data).toHaveLength(1);
    expect(complaintMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ customerId: COMPLAINT_IDS.customerId }) })
    );
  });

  it('filters by outletId via order.is when role is OUTLET_ADMIN', async () => {
    complaintMock.findMany.mockResolvedValue([makeComplaintWithRelations()] as never);
    complaintMock.count.mockResolvedValue(1);

    await ComplaintService.list('OUTLET_ADMIN', COMPLAINT_IDS.customerId, COMPLAINT_IDS.outletId, defaultQuery);

    expect(complaintMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ order: { is: { outletId: COMPLAINT_IDS.outletId } } }) })
    );
  });

  it('returns empty result when OUTLET_ADMIN has no outlet (staffOutletId=null)', async () => {
    const result = await ComplaintService.list('OUTLET_ADMIN', COMPLAINT_IDS.customerId, null, defaultQuery);

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
    expect(complaintMock.findMany).not.toHaveBeenCalled();
  });

  it('applies outlet filter when SUPER_ADMIN provides outletId in query', async () => {
    complaintMock.findMany.mockResolvedValue([]);
    complaintMock.count.mockResolvedValue(0);

    await ComplaintService.list('SUPER_ADMIN', COMPLAINT_IDS.customerId, null, { ...defaultQuery, outletId: COMPLAINT_IDS.outletId });

    expect(complaintMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ order: { is: { outletId: COMPLAINT_IDS.outletId } } }) })
    );
  });

  it('does not apply outlet filter when SUPER_ADMIN provides no outletId', async () => {
    complaintMock.findMany.mockResolvedValue([]);
    complaintMock.count.mockResolvedValue(0);

    await ComplaintService.list('SUPER_ADMIN', COMPLAINT_IDS.customerId, null, defaultQuery);

    expect(complaintMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ order: expect.anything() }) })
    );
  });

  it('calculates correct skip and totalPages from pagination params', async () => {
    complaintMock.findMany.mockResolvedValue([]);
    complaintMock.count.mockResolvedValue(25);

    const result = await ComplaintService.list(undefined, COMPLAINT_IDS.customerId, null, { ...defaultQuery, page: 3, limit: 5 });

    expect(complaintMock.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 5 }));
    expect(result.meta.totalPages).toBe(5);
  });
});

describe('ComplaintService.getById', () => {
  it('returns complaint detail for the customer who owns it', async () => {
    complaintMock.findUnique.mockResolvedValue(makeComplaintWithRelations() as never);

    const result = await ComplaintService.getById(undefined, COMPLAINT_IDS.customerId, null, COMPLAINT_IDS.complaintId);

    expect(result.id).toBe(COMPLAINT_IDS.complaintId);
    expect(result.customerName).toBe('Budi Santoso');
  });

  it('throws ResponseError(404) when complaint not found', async () => {
    complaintMock.findUnique.mockResolvedValue(null);

    await expect(
      ComplaintService.getById(undefined, COMPLAINT_IDS.customerId, null, COMPLAINT_IDS.complaintId)
    ).rejects.toMatchObject({ status: 404, message: 'Complaint not found' });
  });

  it('throws ResponseError(404) when complaint belongs to a different customer', async () => {
    complaintMock.findUnique.mockResolvedValue(makeComplaintWithRelations({ customerId: 'other-customer-id' }) as never);

    await expect(
      ComplaintService.getById(undefined, COMPLAINT_IDS.customerId, null, COMPLAINT_IDS.complaintId)
    ).rejects.toMatchObject({ status: 404, message: 'Complaint not found' });
  });

  it('throws ResponseError(404) when OUTLET_ADMIN and complaint belongs to different outlet', async () => {
    const complaint = makeComplaintWithRelations();
    complaintMock.findUnique.mockResolvedValue(complaint as never);

    await expect(
      ComplaintService.getById('OUTLET_ADMIN', COMPLAINT_IDS.customerId, 'different-outlet-id', COMPLAINT_IDS.complaintId)
    ).rejects.toMatchObject({ status: 404, message: 'Complaint not found' });
  });
});

describe('ComplaintService.updateStatus', () => {
  it('transitions OPEN to IN_REVIEW and returns updated status', async () => {
    const updatedAt = new Date();
    complaintMock.findUnique.mockResolvedValue({
      ...makeComplaint({ status: 'OPEN' }),
      order: makeComplaintOrder(),
    } as never);
    complaintMock.update.mockResolvedValue(makeComplaint({ status: 'IN_REVIEW', updatedAt }) as never);

    const result = await ComplaintService.updateStatus('SUPER_ADMIN', null, COMPLAINT_IDS.complaintId, { status: 'IN_REVIEW' });

    expect(result.status).toBe('IN_REVIEW');
    expect(result.id).toBe(COMPLAINT_IDS.complaintId);
  });

  it('transitions IN_REVIEW to RESOLVED', async () => {
    const updatedAt = new Date();
    complaintMock.findUnique.mockResolvedValue({
      ...makeComplaint({ status: 'IN_REVIEW' }),
      order: makeComplaintOrder(),
    } as never);
    complaintMock.update.mockResolvedValue(makeComplaint({ status: 'RESOLVED', updatedAt }) as never);

    const result = await ComplaintService.updateStatus('SUPER_ADMIN', null, COMPLAINT_IDS.complaintId, { status: 'RESOLVED' });

    expect(result.status).toBe('RESOLVED');
  });

  it('throws ResponseError(409) for invalid transition OPEN to RESOLVED', async () => {
    complaintMock.findUnique.mockResolvedValue({
      ...makeComplaint({ status: 'OPEN' }),
      order: makeComplaintOrder(),
    } as never);

    await expect(
      ComplaintService.updateStatus('SUPER_ADMIN', null, COMPLAINT_IDS.complaintId, { status: 'RESOLVED' })
    ).rejects.toMatchObject({ status: 409, message: 'Invalid status transition' });
  });

  it('throws ResponseError(404) when complaint not found', async () => {
    complaintMock.findUnique.mockResolvedValue(null);

    await expect(
      ComplaintService.updateStatus('SUPER_ADMIN', null, COMPLAINT_IDS.complaintId, { status: 'IN_REVIEW' })
    ).rejects.toMatchObject({ status: 404, message: 'Complaint not found' });
  });

  it('throws ResponseError(404) when OUTLET_ADMIN and complaint belongs to different outlet', async () => {
    complaintMock.findUnique.mockResolvedValue({
      ...makeComplaint({ status: 'OPEN' }),
      order: makeComplaintOrder({ outletId: 'other-outlet-id' }),
    } as never);

    await expect(
      ComplaintService.updateStatus('OUTLET_ADMIN', COMPLAINT_IDS.outletId, COMPLAINT_IDS.complaintId, { status: 'IN_REVIEW' })
    ).rejects.toMatchObject({ status: 404, message: 'Complaint not found' });
  });
});
