import { findActivePickup, findActiveDelivery } from './driver-helper';
import {
  toDriverActivePickupTask,
  toDriverActiveDeliveryTask,
  type DriverActiveTaskResponse,
} from './driver-model';

export class DriverService {
  static async getActiveTask(staffId: string): Promise<DriverActiveTaskResponse> {
    const activePickup = await findActivePickup(staffId);
    if (activePickup) return toDriverActivePickupTask(activePickup);
    const activeDelivery = await findActiveDelivery(staffId);
    if (activeDelivery) return toDriverActiveDeliveryTask(activeDelivery);
    return null;
  }
}
