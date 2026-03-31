import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import { haversineDistance } from '@/utils/haversine';
import { PickupStatus, DeliveryStatus } from '@/generated/prisma/enums';
import type { PickupRequest } from '@/generated/prisma/client';
import {
  CreatePickupRequestInput,
  ListPickupRequestsQuery,
} from '@/validations/pickup-request-validation';
import {
  toPickupRequestResponse,
  toPickupRequestListItem,
  toAcceptPickupRequestResponse,
  PaginatedPickupRequestResponse,
} from './pickup-request-model';

export class PickupRequestService {
  static async createPickupRequest(customerId: string, input: CreatePickupRequestInput) {
    // Look up the address and verify it belongs to the customer
    const address = await prisma.address.findUnique({ where: { id: input.addressId } });
    if (!address) throw new ResponseError(404, 'Address not found');
    if (address.userId !== customerId) throw new ResponseError(403, 'Forbidden');

    // Prevent duplicate pending pickup requests for the same address at the same time
    const existingPickup = await prisma.pickupRequest.findFirst({
      where: {
        customerId,
        addressId: input.addressId,
        scheduledAt: new Date(input.scheduledAt),
        status: PickupStatus.PENDING,
      },
    });
    if (existingPickup) {
      throw new ResponseError(409, 'A pickup request for this address at this time already exists');
    }

    // Fetch all active outlets
    const activeOutlets = await prisma.outlet.findMany({
      where: { isActive: true },
    });

    // Compute Haversine distance from address to each outlet
    // Filter to outlets within their respective service radius
    const validOutlets = activeOutlets
      .map((outlet) => ({
        outlet,
        distance: haversineDistance(address.latitude, address.longitude, outlet.latitude, outlet.longitude),
      }))
      .filter(({ outlet, distance }) => distance <= outlet.maxServiceRadiusKm);

    if (validOutlets.length === 0) {
      throw new ResponseError(422, 'No outlet available in your area');
    }

    // Pick the outlet with the smallest distance
    const nearestOutlet = validOutlets.reduce((nearest, current) =>
      current.distance < nearest.distance ? current : nearest
    ).outlet;

    // Create the PickupRequest record
    const pickupRequest = await prisma.pickupRequest.create({
      data: {
        customerId,
        addressId: input.addressId,
        outletId: nearestOutlet.id,
        scheduledAt: new Date(input.scheduledAt),
        status: PickupStatus.PENDING,
      },
      include: { outlet: true },
    });

    return toPickupRequestResponse(pickupRequest);
  }

  static async listUnassignedRequests(
    outletId: string,
    query: ListPickupRequestsQuery
  ): Promise<PaginatedPickupRequestResponse> {
    const skip = (query.page - 1) * query.limit;
    const where = {
      outletId,
      status: PickupStatus.PENDING,
      driverId: null,
    };

    // Run findMany and count atomically to avoid pagination drift
    const [pickupRequests, total] = await prisma.$transaction([
      prisma.pickupRequest.findMany({
        where,
        include: {
          address: true,
          customerUser: true,
        },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: query.limit,
      }),
      prisma.pickupRequest.count({ where }),
    ]);

    return {
      data: pickupRequests.map(toPickupRequestListItem),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  static async acceptPickupRequest(staffId: string, pickupRequestId: string, outletId: string) {
    return prisma.$transaction(async (tx) => {
      // Check One-Task Driver rule: driver cannot have active pickup or delivery
      const activePickup = await tx.pickupRequest.findFirst({
        where: { driverId: staffId, status: PickupStatus.DRIVER_ASSIGNED },
      });
      const activeDelivery = await tx.delivery.findFirst({
        where: {
          driverId: staffId,
          status: { in: [DeliveryStatus.DRIVER_ASSIGNED, DeliveryStatus.OUT_FOR_DELIVERY] },
        },
      });
      if (activePickup || activeDelivery) {
        throw new ResponseError(409, 'Driver already has an active task');
      }

      // Atomically update with status condition to prevent concurrent accepts (race condition fix)
      // This will fail with P2025 if status is not PENDING or ID doesn't exist
      const updated = await tx.pickupRequest
        .update({
          where: {
            id: pickupRequestId,
            status: PickupStatus.PENDING, // Atomic condition
          },
          data: {
            driverId: staffId,
            status: PickupStatus.DRIVER_ASSIGNED,
          },
        })
        .catch(() => {
          throw new ResponseError(404, 'Pickup request not found or already assigned');
        });

      // Verify pickup request belongs to driver's outlet (prevents outlet theft)
      if (updated.outletId !== outletId) {
        throw new ResponseError(403, 'Pickup request belongs to a different outlet');
      }

      return toAcceptPickupRequestResponse(updated as PickupRequest & { driverId: string });
    });
  }
}
