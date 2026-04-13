import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import { CreateBypassRequestInput, toBypassResponse, toBypassCreateResponse, BypassStatus } from './bypass-request-model';
import type { StationType, Prisma } from '@/generated/prisma/client';

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
    options: { page: number; limit: number; status?: BypassStatus }
  ) {
    const { page, limit, status } = options;
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
        orderBy: { createdAt: 'desc' },
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
      },
    };
  }
}