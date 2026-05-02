import { prisma } from '@/application/database';
import { PickupStatus, DeliveryStatus } from '@/generated/prisma/enums';

export const findActivePickup = (staffId: string) =>
  prisma.pickupRequest.findFirst({
    where: { driverId: staffId, status: PickupStatus.DRIVER_ASSIGNED },
    include: { address: true, customerUser: true },
  });

export const findActiveDelivery = (staffId: string) =>
  prisma.delivery.findFirst({
    where: { driverId: staffId, status: { in: [DeliveryStatus.DRIVER_ASSIGNED, DeliveryStatus.OUT_FOR_DELIVERY] } },
    include: { order: { include: { pickupRequest: { include: { address: true, customerUser: true } } } } },
  });
