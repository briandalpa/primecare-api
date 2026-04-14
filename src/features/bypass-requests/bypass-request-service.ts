import bcrypt from 'bcrypt';
import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import {
  CreateBypassRequestInput,
  toBypassResponse,
  toBypassCreateResponse,
  toApproveBypassResponse,
  toRejectBypassResponse,
  toBypassDetailResponse,
  BypassStatus,
  BypassItemResponse,
} from './bypass-request-model';
import type { StationType, OrderStatus, Prisma } from '@/generated/prisma/client';

export class BypassRequestService {
  static async create(
    workerId: string,
    orderId: string,
    station: StationType,
    data: CreateBypassRequestInput
  ) {
    return prisma.$transaction(async (tx) => {
      // Find StationRecord for this order + station
      const stationRecord = await tx.stationRecord.findUnique({
        where: {
          orderId_station: { orderId, station },
        },
        include: { stationItems: true },
      });

      if (!stationRecord) {
        throw new ResponseError(404, 'Station record not found');
      }

      // Verify worker owns this station
      if (stationRecord.staffId !== workerId) {
        throw new ResponseError(403, 'You are not assigned to this station');
      }

      // Fetch reference items based on station
      let referenceItems: Array<{ laundryItemId: string; quantity: number }>;

      if (station === 'WASHING') {
        const orderItems = await tx.orderItem.findMany({
          where: { orderId },
        });
        referenceItems = orderItems.map((item) => ({
          laundryItemId: item.laundryItemId,
          quantity: item.quantity,
        }));
      } else {
        // IRONING or PACKING: get previous station's StationItem records
        const prevStation = station === 'IRONING' ? 'WASHING' : 'IRONING';
        const prevStationRecord = await tx.stationRecord.findUnique({
          where: {
            orderId_station: { orderId, station: prevStation },
          },
          include: { stationItems: true },
        });

        if (!prevStationRecord) {
          throw new ResponseError(
            422,
            'Previous station has no completed records. Cannot proceed.'
          );
        }

        referenceItems = prevStationRecord.stationItems.map((item) => ({
          laundryItemId: item.laundryItemId,
          quantity: item.quantity,
        }));
      }

      // Compare submitted items against reference items
      const referenceMap = new Map(
        referenceItems.map((item) => [item.laundryItemId, item.quantity])
      );
      const submittedMap = new Map(
        data.items.map((item) => [item.laundryItemId, item.quantity])
      );

      // Check if quantities match exactly
      let hasMatch = true;
      if (referenceMap.size !== submittedMap.size) {
        hasMatch = false;
      } else {
        for (const [itemId, qty] of referenceMap) {
          if (submittedMap.get(itemId) !== qty) {
            hasMatch = false;
            break;
          }
        }
      }

      if (hasMatch) {
        throw new ResponseError(400, 'No quantity mismatch detected');
      }

      // Check for existing PENDING bypass
      const existing = await tx.bypassRequest.findFirst({
        where: {
          stationRecordId: stationRecord.id,
          status: 'PENDING',
        },
      });

      if (existing) {
        throw new ResponseError(409, 'A pending bypass request already exists for this station');
      }

      // Delete existing StationItem rows (clean slate on re-submission after rejection)
      await tx.stationItem.deleteMany({
        where: { stationRecordId: stationRecord.id },
      });

      // Create new StationItem rows for submitted items
      await Promise.all(
        data.items.map((item) =>
          tx.stationItem.create({
            data: {
              stationRecordId: stationRecord.id,
              laundryItemId: item.laundryItemId,
              quantity: item.quantity,
            },
          })
        )
      );

      // Create BypassRequest
      const bypass = await tx.bypassRequest.create({
        data: {
          stationRecordId: stationRecord.id,
          workerId,
          adminId: null,
          status: 'PENDING',
          problemDescription: null,
        },
      });

      // Update StationRecord status
      await tx.stationRecord.update({
        where: { id: stationRecord.id },
        data: {
          status: 'BYPASS_REQUESTED',
        },
      });

      return toBypassCreateResponse(bypass);
    });
  }

  // PCS-128: Get bypass requests for admin
  static async getAll(
    adminId: string,
    role: string,
    outletId: string | undefined,
    options: { page: number; limit: number; status?: BypassStatus; order?: 'asc' | 'desc' }
  ) {
    const { page, limit, status, order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.BypassRequestWhereInput = {};

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // Filter by outlet if OUTLET_ADMIN
    if (role === 'OUTLET_ADMIN' && outletId) {
      where.stationRecord = {
        order: {
          outletId,
        },
      };
    }

    const [data, total] = await Promise.all([
      prisma.bypassRequest.findMany({
        where,
        include: {
          stationRecord: {
            include: {
              order: true,
            },
          },
          worker: {
            include: {
              user: true,
            },
          },
          admin: {
            include: {
              user: true,
            },
          },
        },
        orderBy: { createdAt: order },
        skip,
        take: limit,
      }),
      prisma.bypassRequest.count({ where }),
    ]);

    return {
      data: data.map(toBypassResponse),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // PCS-129: Approve a bypass request
  static async approve(
    adminStaffId: string,
    adminUserId: string,
    bypassId: string,
    password: string,
    problemDescription: string
  ) {
    return prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({
        where: { userId: adminUserId, providerId: 'credential' },
      });
      if (!account?.password) throw new ResponseError(401, 'Incorrect password');
      if (!await bcrypt.compare(password, account.password)) throw new ResponseError(401, 'Incorrect password');

      const bypass = await tx.bypassRequest.findUnique({
        where: { id: bypassId },
        include: { stationRecord: { include: { order: true } } },
      });
      if (!bypass) throw new ResponseError(404, 'Bypass request not found');
      if (bypass.status !== 'PENDING') throw new ResponseError(409, 'Bypass request is not in PENDING state');

      const updated = await tx.bypassRequest.update({
        where: { id: bypassId },
        data: { status: 'APPROVED', adminId: adminStaffId, problemDescription, resolvedAt: new Date() },
      });

      await tx.stationRecord.update({
        where: { id: bypass.stationRecordId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      const currentStatus = bypass.stationRecord.order.status;
      let nextStatus: OrderStatus = currentStatus;

      if (currentStatus === 'LAUNDRY_BEING_WASHED') {
        nextStatus = 'LAUNDRY_BEING_IRONED';
      } else if (currentStatus === 'LAUNDRY_BEING_IRONED') {
        nextStatus = 'LAUNDRY_BEING_PACKED';
      } else if (currentStatus === 'LAUNDRY_BEING_PACKED') {
        if (bypass.stationRecord.order.paymentStatus === 'PAID') {
          nextStatus = 'LAUNDRY_READY_FOR_DELIVERY';
          await tx.delivery.create({ data: { orderId: bypass.stationRecord.order.id } });
        } else {
          nextStatus = 'WAITING_FOR_PAYMENT';
        }
      }

      await tx.order.update({
        where: { id: bypass.stationRecord.order.id },
        data: { status: nextStatus },
      });

      return toApproveBypassResponse(updated, nextStatus);
    });
  }

  // PCS-129: Reject a bypass request
  static async reject(
    adminStaffId: string,
    adminUserId: string,
    bypassId: string,
    password: string
  ) {
    return prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({
        where: { userId: adminUserId, providerId: 'credential' },
      });
      if (!account?.password) throw new ResponseError(401, 'Incorrect password');
      if (!await bcrypt.compare(password, account.password)) throw new ResponseError(401, 'Incorrect password');

      const bypass = await tx.bypassRequest.findUnique({ where: { id: bypassId } });
      if (!bypass) throw new ResponseError(404, 'Bypass request not found');
      if (bypass.status !== 'PENDING') throw new ResponseError(409, 'Bypass request is not in PENDING state');

      const updated = await tx.bypassRequest.update({
        where: { id: bypassId },
        data: { status: 'REJECTED', adminId: adminStaffId, resolvedAt: new Date() },
      });

      await tx.stationRecord.update({
        where: { id: bypass.stationRecordId },
        data: { status: 'IN_PROGRESS' },
      });

      return toRejectBypassResponse(updated);
    });
  }

  // PCS-129: Get bypass request detail
  static async getById(role: string, outletId: string | undefined, bypassId: string) {
    const bypass = await prisma.bypassRequest.findUnique({
      where: { id: bypassId },
      include: {
        stationRecord: {
          include: {
            order: true,
            stationItems: { include: { laundryItem: true } },
          },
        },
        worker: { include: { user: true } },
        admin: { include: { user: true } },
      },
    });

    if (!bypass) throw new ResponseError(404, 'Bypass request not found');

    if (role === 'OUTLET_ADMIN' && outletId && bypass.stationRecord.order.outletId !== outletId) {
      throw new ResponseError(403, 'Access denied');
    }

    const station = bypass.stationRecord.station;
    const orderId = bypass.stationRecord.orderId;
    let referenceItems: BypassItemResponse[];

    if (station === 'WASHING') {
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId },
        include: { laundryItem: true },
      });
      referenceItems = orderItems.map((item) => ({
        laundryItemId: item.laundryItemId,
        itemName: item.laundryItem.name,
        quantity: item.quantity,
      }));
    } else {
      const prevStation = station === 'IRONING' ? 'WASHING' : 'IRONING';
      const prevRecord = await prisma.stationRecord.findUnique({
        where: { orderId_station: { orderId, station: prevStation } },
        include: { stationItems: { include: { laundryItem: true } } },
      });
      referenceItems = (prevRecord?.stationItems ?? []).map((item) => ({
        laundryItemId: item.laundryItemId,
        itemName: item.laundryItem.name,
        quantity: item.quantity,
      }));
    }

    return toBypassDetailResponse(bypass, referenceItems);
  }
}