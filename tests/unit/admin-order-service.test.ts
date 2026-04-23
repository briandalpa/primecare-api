jest.mock('@/application/database', () => ({
  prisma: {
    staff: { findFirst: jest.fn() },
    order: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), count: jest.fn() },
    orderItem: { create: jest.fn() },
    laundryItem: { upsert: jest.fn() },
    stationRecord: { create: jest.fn() },
    pickupRequest: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/features/worker-notifications/worker-notification-service', () => ({
  WorkerNotificationService: {
    publishOrderArrival: jest.fn(),
  },
}));

import { AdminOrderService } from '@/features/admin-orders/admin-order-service';
import { prisma } from '@/application/database';
import { WorkerNotificationService } from '@/features/worker-notifications/worker-notification-service';

const superAdmin = { id: 'staff-sa', role: 'SUPER_ADMIN', outletId: null };
const outletAdmin = { id: 'staff-oa', role: 'OUTLET_ADMIN', outletId: 'outlet-1' };
const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const defaultQuery = { page: 1, limit: 10 };

describe('AdminOrderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
      id: 'worker-washing-1',
      outletId: 'outlet-1',
      role: 'WORKER',
      workerType: 'WASHING',
      isActive: true,
      createdAt: new Date(),
    });
    (prisma.$transaction as jest.Mock).mockImplementation((ops: Promise<unknown>[] | Function) =>
      typeof ops === 'function' ? ops(prisma) : Promise.all(ops)
    );
  });

  describe('getAdminOrders', () => {
    it('should return paginated data with correct meta shape', async () => {
      const mockOrders = [{ id: 'order-1' }, { id: 'order-2' }];
      (prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);
      (prisma.order.count as jest.Mock).mockResolvedValue(2);

      const result = await AdminOrderService.getAdminOrders(superAdmin, defaultQuery);

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 2, totalPages: 1 });
    });

    it('should allow SUPER_ADMIN to filter by optional outletId', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(0);

      await AdminOrderService.getAdminOrders(superAdmin, { ...defaultQuery, outletId: 'outlet-1' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ outletId: 'outlet-1' }) })
      );
    });

    it('should scope OUTLET_ADMIN to their own outletId regardless of query override', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(0);

      await AdminOrderService.getAdminOrders(outletAdmin, { ...defaultQuery, outletId: 'outlet-hacker' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ outletId: 'outlet-1' }) })
      );
    });

    it('should forward status filter to where clause', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(0);

      await AdminOrderService.getAdminOrders(superAdmin, { ...defaultQuery, status: 'LAUNDRY_BEING_WASHED' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'LAUNDRY_BEING_WASHED' }) })
      );
    });

    it('should build dateFrom + dateTo as createdAt range', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(0);

      await AdminOrderService.getAdminOrders(superAdmin, {
        ...defaultQuery,
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
      });

      const call = (prisma.order.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.createdAt).toHaveProperty('gte');
      expect(call.where.createdAt).toHaveProperty('lte');
    });

    it('should build partial range when only dateFrom is provided', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(0);

      await AdminOrderService.getAdminOrders(superAdmin, { ...defaultQuery, dateFrom: '2024-01-01' });

      const call = (prisma.order.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.createdAt).toHaveProperty('gte');
      expect(call.where.createdAt).not.toHaveProperty('lte');
    });

    it('should forward sortBy and sortOrder to orderBy', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(0);

      await AdminOrderService.getAdminOrders(superAdmin, { ...defaultQuery, sortBy: 'totalPrice', sortOrder: 'asc' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { totalPrice: 'asc' } })
      );
    });

    it('should default to orderBy createdAt desc when not specified', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(0);

      await AdminOrderService.getAdminOrders(superAdmin, defaultQuery);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } })
      );
    });

    it('should calculate skip as (page - 1) * limit', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(0);

      await AdminOrderService.getAdminOrders(superAdmin, { page: 3, limit: 5 });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 })
      );
    });

    it('should compute totalPages correctly from total and limit', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(11);

      const result = await AdminOrderService.getAdminOrders(superAdmin, { page: 1, limit: 5 });

      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe('getAdminOrderDetail', () => {
    const mockOrder = { id: 'order-1', outletId: 'outlet-1' };

    it('should return order for SUPER_ADMIN', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      const result = await AdminOrderService.getAdminOrderDetail(superAdmin, 'order-1');

      expect(result.id).toBe('order-1');
    });

    it('should return order for OUTLET_ADMIN when outletId matches', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      const result = await AdminOrderService.getAdminOrderDetail(outletAdmin, 'order-1');

      expect(result.id).toBe('order-1');
    });

    it('should throw 404 when order not found', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(AdminOrderService.getAdminOrderDetail(superAdmin, 'nonexistent'))
        .rejects.toMatchObject({ status: 404 });
    });

    it('should throw 403 when OUTLET_ADMIN accesses order from different outlet', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({ id: 'order-x', outletId: 'outlet-other' });

      await expect(AdminOrderService.getAdminOrderDetail(outletAdmin, 'order-x'))
        .rejects.toMatchObject({ status: 403 });
    });

    it('should allow SUPER_ADMIN to access order from any outlet', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({ id: 'order-x', outletId: 'outlet-other' });

      const result = await AdminOrderService.getAdminOrderDetail(superAdmin, 'order-x');

      expect(result.id).toBe('order-x');
    });
  });

  describe('getAdminPickupRequests', () => {
    it('should return paginated results with correct meta', async () => {
      (prisma.pickupRequest.findMany as jest.Mock).mockResolvedValue([{ id: 'pr-1' }]);
      (prisma.pickupRequest.count as jest.Mock).mockResolvedValue(1);

      const result = await AdminOrderService.getAdminPickupRequests(superAdmin, 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    });

    it('should NOT include outletId filter for SUPER_ADMIN', async () => {
      (prisma.pickupRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.pickupRequest.count as jest.Mock).mockResolvedValue(0);

      await AdminOrderService.getAdminPickupRequests(superAdmin, 1, 10);

      const call = (prisma.pickupRequest.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where).not.toHaveProperty('outletId');
    });

    it('should scope OUTLET_ADMIN query by outletId', async () => {
      (prisma.pickupRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.pickupRequest.count as jest.Mock).mockResolvedValue(0);

      await AdminOrderService.getAdminPickupRequests(outletAdmin, 1, 10);

      expect(prisma.pickupRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ outletId: 'outlet-1' }) })
      );
    });

    it('should always include status PICKED_UP and order null in where', async () => {
      (prisma.pickupRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.pickupRequest.count as jest.Mock).mockResolvedValue(0);

      await AdminOrderService.getAdminPickupRequests(superAdmin, 1, 10);

      const call = (prisma.pickupRequest.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.status).toBe('PICKED_UP');
      expect(call.where.order).toBeNull();
    });

    it('should calculate skip correctly from page and limit', async () => {
      (prisma.pickupRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.pickupRequest.count as jest.Mock).mockResolvedValue(0);

      await AdminOrderService.getAdminPickupRequests(superAdmin, 2, 5);

      expect(prisma.pickupRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 })
      );
    });
  });

  describe('createAdminOrder', () => {
    const validInput = {
      pickupRequestId: VALID_UUID,
      pricePerKg: 10000,
      totalWeightKg: 3,
      items: [
        { laundryItemId: VALID_UUID, quantity: 2 },
        { laundryItemId: '223e4567-e89b-12d3-a456-426614174001', quantity: 1 },
      ],
    };
    const mockPickup = {
      id: VALID_UUID,
      outletId: 'outlet-1',
      status: 'PICKED_UP',
      order: null,
      outlet: { latitude: -6.2, longitude: 106.8 },
      address: { latitude: -6.205, longitude: 106.805 },
    };
    const mockOrder = { id: 'order-new', outletId: 'outlet-1', status: 'LAUNDRY_BEING_WASHED' };

    it('should create order atomically via $transaction and return the order', async () => {
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue(mockPickup);
      (prisma.order.create as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.orderItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });

      const result = await AdminOrderService.createAdminOrder(superAdmin, validInput);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(mockOrder);
    });

    it('should calculate totalPrice as totalWeightKg * pricePerKg', async () => {
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue(mockPickup);
      (prisma.order.create as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.orderItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });

      await AdminOrderService.createAdminOrder(superAdmin, validInput);

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ totalPrice: 30000 }) })
      );
    });

    it('should use outletId from pickupRequest and staffId from staff in order.create', async () => {
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue(mockPickup);
      (prisma.order.create as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.orderItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });

      await AdminOrderService.createAdminOrder(superAdmin, validInput);

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ outletId: 'outlet-1', staffId: 'staff-sa' }),
        })
      );
    });

    it('should create base items inside the transaction', async () => {
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue(mockPickup);
      (prisma.order.create as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.stationRecord.create as jest.Mock).mockResolvedValue({ id: 'sr-1' });
      (prisma.orderItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });

      await AdminOrderService.createAdminOrder(superAdmin, validInput);

      expect(prisma.orderItem.create).toHaveBeenCalledTimes(validInput.items.length);
    });

    it('should add manual priced items to total and create priced order items', async () => {
      const input = {
        ...validInput,
        manualItems: [{ name: 'Bedcover', quantity: 2, unitPrice: 25000 }],
      };
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue(mockPickup);
      (prisma.order.create as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.stationRecord.create as jest.Mock).mockResolvedValue({ id: 'sr-1' });
      (prisma.orderItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });
      (prisma.laundryItem.upsert as jest.Mock).mockResolvedValue({ id: 'manual-item-1' });

      await AdminOrderService.createAdminOrder(superAdmin, input);

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ totalPrice: 80000 }) })
      );
      expect(prisma.orderItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          laundryItemId: 'manual-item-1',
          quantity: 2,
          unitPrice: 25000,
          lineTotal: 50000,
          isManualPriced: true,
        }),
      });
    });

    it('should set created order status to LAUNDRY_BEING_WASHED', async () => {
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue(mockPickup);
      (prisma.order.create as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.orderItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });

      await AdminOrderService.createAdminOrder(superAdmin, validInput);

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'LAUNDRY_BEING_WASHED' }),
        }),
      );
    });

    it('should publish a worker arrival notification after order creation', async () => {
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue(mockPickup);
      (prisma.order.create as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.stationRecord.create as jest.Mock).mockResolvedValue({ id: 'sr-1' });
      (prisma.orderItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });

      await AdminOrderService.createAdminOrder(superAdmin, validInput);

      expect(WorkerNotificationService.publishOrderArrival).toHaveBeenCalledWith({
        orderId: 'order-new',
        outletId: 'outlet-1',
        orderStatus: 'LAUNDRY_BEING_WASHED',
      });
    });

    it('should create initial WASHING station record in progress', async () => {
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue(mockPickup);
      (prisma.order.create as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.stationRecord.create as jest.Mock).mockResolvedValue({ id: 'sr-1' });
      (prisma.orderItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });

      await AdminOrderService.createAdminOrder(superAdmin, validInput);

      const createdOrderId = (prisma.order.create as jest.Mock).mock.calls[0][0].data.id;
      expect(prisma.stationRecord.create).toHaveBeenCalledWith({
        data: {
          orderId: createdOrderId,
          station: 'WASHING',
          staffId: 'worker-washing-1',
          status: 'IN_PROGRESS',
        },
      });
    });

    it('should throw 404 when pickupRequest not found', async () => {
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(AdminOrderService.createAdminOrder(superAdmin, validInput))
        .rejects.toMatchObject({ status: 404 });
    });

    it('should throw 409 when pickupRequest status is not PICKED_UP', async () => {
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockPickup,
        status: 'DRIVER_ASSIGNED',
      });

      await expect(AdminOrderService.createAdminOrder(superAdmin, validInput))
        .rejects.toMatchObject({ status: 409 });
    });

    it('should throw 409 when order already exists for this pickup', async () => {
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockPickup,
        order: { id: 'existing-order' },
      });

      await expect(AdminOrderService.createAdminOrder(superAdmin, validInput))
        .rejects.toMatchObject({ status: 409 });
    });

    it('should throw 403 when OUTLET_ADMIN creates order for different outlet pickup', async () => {
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockPickup,
        outletId: 'outlet-other',
      });

      await expect(AdminOrderService.createAdminOrder(outletAdmin, validInput))
        .rejects.toMatchObject({ status: 403 });
    });

    it('should allow SUPER_ADMIN to create order for any outlet', async () => {
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockPickup,
        outletId: 'outlet-other',
      });
      (prisma.order.create as jest.Mock).mockResolvedValue({
        id: 'order-new',
        outletId: 'outlet-other',
        status: 'LAUNDRY_BEING_WASHED',
      });
      (prisma.stationRecord.create as jest.Mock).mockResolvedValue({ id: 'sr-1' });
      (prisma.orderItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });

      const result = await AdminOrderService.createAdminOrder(superAdmin, validInput);

      expect(result.id).toBe('order-new');
    });
  });
});
