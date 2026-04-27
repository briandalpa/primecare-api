import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import { haversineDistance } from '@/utils/haversine';
import { PickupStatus, DeliveryStatus, OrderStatus } from '@/generated/prisma/enums';
import type { PickupRequest, Outlet, Prisma } from '@/generated/prisma/client';
import {
  CreatePickupRequestInput,
  ListPickupRequestsQuery,
  ListMyPickupRequestsQuery,
  PickupHistoryQuery,
} from '@/validations/pickup-request-validation';
import {
  toPickupRequestResponse,
  toPickupRequestListItem,
  toAcceptPickupRequestResponse,
  toCustomerPickupListItem,
  toPickupHistoryItem,
  PaginatedPickupRequestResponse,
  PaginatedCustomerPickupResponse,
  PaginatedHistoryResponse,
} from './pickup-request-model';

function findNearestOutlet(outlets: Outlet[], lat: number, lng: number): Outlet {
  const candidates = outlets
    .map((outlet) => ({
      outlet,
      distance: haversineDistance(lat, lng, outlet.latitude, outlet.longitude),
    }))
    .filter(({ outlet, distance }) => distance <= outlet.maxServiceRadiusKm);

  if (candidates.length === 0) throw new ResponseError(422, 'No outlet available in your area');

  return candidates.reduce((nearest, current) =>
    current.distance < nearest.distance ? current : nearest
  ).outlet;
}

async function checkDriverHasActiveTask(tx: Prisma.TransactionClient, staffId: string): Promise<void> {
  const activePickup = await tx.pickupRequest.findFirst({
    where: { driverId: staffId, status: PickupStatus.DRIVER_ASSIGNED },
  });
  const activeDelivery = await tx.delivery.findFirst({
    where: { driverId: staffId, status: { in: [DeliveryStatus.DRIVER_ASSIGNED, DeliveryStatus.OUT_FOR_DELIVERY] } },
  });
  if (activePickup || activeDelivery) throw new ResponseError(409, 'Driver already has an active task');
}

async function advanceOrderStatus(tx: Prisma.TransactionClient, pickupRequestId: string, status: OrderStatus): Promise<void> {
  await tx.order
    .update({ where: { pickupRequestId }, data: { status } })
    .catch(() => {
      // Non-blocking: order may not exist yet if admin hasn't created it
    });
}

async function runAcceptPickupTx(tx: Prisma.TransactionClient, staffId: string, pickupRequestId: string, outletId: string) {
  await checkDriverHasActiveTask(tx, staffId);
  // Atomic update with status condition prevents concurrent accepts
  const updated = await tx.pickupRequest
    .update({ where: { id: pickupRequestId, status: PickupStatus.PENDING }, data: { driverId: staffId, status: PickupStatus.DRIVER_ASSIGNED } })
    .catch(() => { throw new ResponseError(404, 'Pickup request not found or already assigned'); });
  if (updated.outletId !== outletId) throw new ResponseError(403, 'Pickup request belongs to a different outlet');
  await advanceOrderStatus(tx, pickupRequestId, OrderStatus.LAUNDRY_EN_ROUTE_TO_OUTLET);
  return toAcceptPickupRequestResponse(updated as PickupRequest & { driverId: string }, OrderStatus.LAUNDRY_EN_ROUTE_TO_OUTLET);
}

export class PickupRequestService {
  static async createPickupRequest(customerId: string, input: CreatePickupRequestInput) {
    const address = await prisma.address.findUnique({ where: { id: input.addressId } });
    if (!address) throw new ResponseError(404, 'Address not found');
    if (address.userId !== customerId) throw new ResponseError(403, 'Forbidden');
    const existingPickup = await prisma.pickupRequest.findFirst({ where: { customerId, addressId: input.addressId, scheduledAt: new Date(input.scheduledAt), status: PickupStatus.PENDING } });
    if (existingPickup) throw new ResponseError(409, 'A pickup request for this address at this time already exists');
    const activeOutlets = await prisma.outlet.findMany({ where: { isActive: true } });
    const nearestOutlet = findNearestOutlet(activeOutlets, address.latitude, address.longitude);
    const pickupRequest = await prisma.pickupRequest.create({ data: { customerId, addressId: input.addressId, outletId: nearestOutlet.id, scheduledAt: new Date(input.scheduledAt), status: PickupStatus.PENDING }, include: { outlet: true } });
    return toPickupRequestResponse(pickupRequest);
  }

  static async listUnassignedRequests(outletId: string, query: ListPickupRequestsQuery): Promise<PaginatedPickupRequestResponse> {
    const skip = (query.page - 1) * query.limit;
    const where = { outletId, status: PickupStatus.PENDING, driverId: null };

    // Run findMany and count atomically to avoid pagination drift
    const [pickupRequests, total] = await prisma.$transaction([
      prisma.pickupRequest.findMany({ where, include: { address: true, customerUser: true }, orderBy: { scheduledAt: 'asc' }, skip, take: query.limit }),
      prisma.pickupRequest.count({ where }),
    ]);

    return {
      data: pickupRequests.map(toPickupRequestListItem),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  static async acceptPickupRequest(staffId: string, pickupRequestId: string, outletId: string | null | undefined) {
    if (!outletId) throw new ResponseError(409, 'Driver is not assigned to any outlet');
    return prisma.$transaction((tx) => runAcceptPickupTx(tx, staffId, pickupRequestId, outletId));
  }

  static async completePickupRequest(staffId: string, outletId: string | null | undefined, pickupRequestId: string) {
    if (!outletId) throw new ResponseError(409, 'Driver is not assigned to any outlet');
    return prisma.$transaction(async (tx) => {
      const pickup = await tx.pickupRequest.findFirst({ where: { id: pickupRequestId, status: PickupStatus.DRIVER_ASSIGNED } });
      if (!pickup) throw new ResponseError(404, 'Pickup request not found or not in assigned state');
      if (pickup.driverId !== staffId) throw new ResponseError(403, 'You are not the assigned driver for this pickup');
      await tx.pickupRequest.update({ where: { id: pickupRequestId }, data: { status: PickupStatus.PICKED_UP } });
      await advanceOrderStatus(tx, pickupRequestId, OrderStatus.LAUNDRY_ARRIVED_AT_OUTLET);
      return { id: pickupRequestId, status: PickupStatus.PICKED_UP, orderStatus: OrderStatus.LAUNDRY_ARRIVED_AT_OUTLET };
    });
  }

  static async listCustomerPickupRequests(customerId: string, query: ListMyPickupRequestsQuery): Promise<PaginatedCustomerPickupResponse> {
    const skip = (query.page - 1) * query.limit;
    const where = { customerId, ...(query.status && { status: query.status }) };

    const [pickupRequests, total] = await prisma.$transaction([
      prisma.pickupRequest.findMany({ where, include: { outlet: true }, orderBy: { createdAt: 'desc' }, skip, take: query.limit }),
      prisma.pickupRequest.count({ where }),
    ]);

    return {
      data: pickupRequests.map(toCustomerPickupListItem),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  static async listDriverHistory(staffId: string, query: PickupHistoryQuery): Promise<PaginatedHistoryResponse> {
    const skip = (query.page - 1) * query.limit;
    const dateFilter = query.fromDate ?? query.toDate
      ? { createdAt: { ...(query.fromDate && { gte: new Date(query.fromDate) }), ...(query.toDate && { lte: new Date(query.toDate) }) } }
      : {};
    const where = { driverId: staffId, status: PickupStatus.PICKED_UP, ...dateFilter };
    const [pickupRequests, total] = await prisma.$transaction([
      prisma.pickupRequest.findMany({ where, include: { address: true, customerUser: true, order: true }, orderBy: { [query.sortBy ?? 'createdAt']: query.order ?? 'desc' }, skip, take: query.limit }),
      prisma.pickupRequest.count({ where }),
    ]);
    return { data: pickupRequests.map(toPickupHistoryItem), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }
}
