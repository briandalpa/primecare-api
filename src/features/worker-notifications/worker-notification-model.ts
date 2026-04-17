import {
  OrderStatus,
  StationType,
  type Staff,
} from '@/generated/prisma/client';

export const WORKER_NOTIFICATION_CONNECTED_EVENT = 'worker-notification-connected';
export const WORKER_ORDER_ARRIVED_EVENT = 'worker-order-arrived';
export const WORKER_NOTIFICATION_PING_EVENT = 'worker-notification-ping';
export const WORKER_NOTIFICATION_PING_MS = 25_000;

export type WorkerNotificationStation = `${StationType}`;

export interface WorkerOrderArrivalPayload {
  event: typeof WORKER_ORDER_ARRIVED_EVENT;
  orderId: string;
  outletId: string;
  station: WorkerNotificationStation;
  orderStatus: string;
  occurredAt: string;
}

export interface WorkerNotificationSubscriber {
  id: string;
  outletId: string;
  station: WorkerNotificationStation;
}

export interface WorkerNotificationContext {
  orderId: string;
  outletId: string;
  orderStatus: string;
}

export const resolveStationFromOrderStatus = (
  orderStatus: string,
): WorkerNotificationStation | null => {
  if (orderStatus === OrderStatus.LAUNDRY_BEING_WASHED) return StationType.WASHING;
  if (orderStatus === OrderStatus.LAUNDRY_BEING_IRONED) return StationType.IRONING;
  if (orderStatus === OrderStatus.LAUNDRY_BEING_PACKED) return StationType.PACKING;
  return null;
};

export const toWorkerSubscriber = (
  staff: Staff,
  id: string,
): WorkerNotificationSubscriber => ({
  id,
  outletId: staff.outletId!,
  station: staff.workerType!,
});

export const toWorkerOrderArrivalPayload = (
  data: WorkerNotificationContext,
): WorkerOrderArrivalPayload | null => {
  const station = resolveStationFromOrderStatus(data.orderStatus);
  if (!station) return null;

  return {
    event: WORKER_ORDER_ARRIVED_EVENT,
    orderId: data.orderId,
    outletId: data.outletId,
    station,
    orderStatus: data.orderStatus,
    occurredAt: new Date().toISOString(),
  };
};
