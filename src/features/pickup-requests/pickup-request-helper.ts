import { ResponseError } from '@/error/response-error';
import { haversineDistance } from '@/utils/haversine';
import { PickupStatus, DeliveryStatus, OrderStatus } from '@/generated/prisma/enums';
import type { PickupRequest, Outlet, Prisma } from '@/generated/prisma/client';
import { toAcceptPickupRequestResponse } from './pickup-request-model';

export function findNearestOutlet(outlets: Outlet[], lat: number, lng: number): Outlet {
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

export async function checkDriverHasActiveTask(tx: Prisma.TransactionClient, staffId: string): Promise<void> {
  const activePickup = await tx.pickupRequest.findFirst({
    where: { driverId: staffId, status: PickupStatus.DRIVER_ASSIGNED },
  });
  const activeDelivery = await tx.delivery.findFirst({
    where: { driverId: staffId, status: { in: [DeliveryStatus.DRIVER_ASSIGNED, DeliveryStatus.OUT_FOR_DELIVERY] } },
  });
  if (activePickup || activeDelivery) throw new ResponseError(409, 'Driver already has an active task');
}

export async function advanceOrderStatus(tx: Prisma.TransactionClient, pickupRequestId: string, status: OrderStatus): Promise<void> {
  await tx.order
    .update({ where: { pickupRequestId }, data: { status } })
    .catch(() => {
      // Non-blocking: order may not exist yet if admin hasn't created it
    });
}

export async function runAcceptPickupTx(tx: Prisma.TransactionClient, staffId: string, pickupRequestId: string, outletId: string) {
  await checkDriverHasActiveTask(tx, staffId);
  // Atomic update with status condition prevents concurrent accepts
  const updated = await tx.pickupRequest
    .update({ where: { id: pickupRequestId, status: PickupStatus.PENDING }, data: { driverId: staffId, status: PickupStatus.DRIVER_ASSIGNED } })
    .catch(() => { throw new ResponseError(404, 'Pickup request not found or already assigned'); });
  if (updated.outletId !== outletId) throw new ResponseError(403, 'Pickup request belongs to a different outlet');
  await advanceOrderStatus(tx, pickupRequestId, OrderStatus.LAUNDRY_EN_ROUTE_TO_OUTLET);
  return toAcceptPickupRequestResponse(updated as PickupRequest & { driverId: string }, OrderStatus.LAUNDRY_EN_ROUTE_TO_OUTLET);
}
