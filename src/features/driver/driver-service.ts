import { prisma } from '@/application/database';
import { PickupStatus, DeliveryStatus } from '@/generated/prisma/enums';
import {
  toDriverActivePickupTask,
  toDriverActiveDeliveryTask,
  type DriverActiveTaskResponse,
} from './driver-model';

const findActivePickup = (staffId: string) =>
  prisma.pickupRequest.findFirst({
    where: { driverId: staffId, status: PickupStatus.DRIVER_ASSIGNED },
    include: { address: true, customerUser: true },
  });

const findActiveDelivery = (staffId: string) =>
  prisma.delivery.findFirst({
    where: { driverId: staffId, status: { in: [DeliveryStatus.DRIVER_ASSIGNED, DeliveryStatus.OUT_FOR_DELIVERY] } },
    include: { order: { include: { pickupRequest: { include: { address: true, customerUser: true } } } } },
  });

export class DriverService {
  static async getActiveTask(staffId: string): Promise<DriverActiveTaskResponse> {
    const activePickup = await findActivePickup(staffId);
    if (activePickup) return toDriverActivePickupTask(activePickup);
    const activeDelivery = await findActiveDelivery(staffId);
    if (activeDelivery) return toDriverActiveDeliveryTask(activeDelivery);
    return null;
  }
}
