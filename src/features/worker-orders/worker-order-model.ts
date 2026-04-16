import type { Prisma, Staff, StationStatus, StationType } from '@/generated/prisma/client';

export type WorkerOrderListQuery = {
  page: number;
  limit: number;
  status?: StationStatus;
  date?: string;
};

export type WorkerOrderResponse = {
  id: string;
  orderId: string;
  station: StationType;
  status: StationStatus;
  totalItems: number;
  updatedAt: Date;
  createdAt: Date;
  customerName: string | null;
  outletName: string;
};

export type WorkerQueueContext = Pick<Staff, 'id' | 'outletId' | 'workerType'>;

type WorkerOrderRecord = Prisma.StationRecordGetPayload<{
  include: {
    order: {
      include: {
        outlet: true;
        pickupRequest: {
          include: {
            customerUser: {
              select: {
                name: true;
              };
            };
          };
        };
        items: true;
      };
    };
  };
}>;

export function toWorkerOrderResponse(
  record: WorkerOrderRecord,
): WorkerOrderResponse {
  return {
    id: record.id,
    orderId: record.orderId,
    station: record.station,
    status: record.status,
    totalItems: record.order.items.reduce(
      (total, item) => total + item.quantity,
      0,
    ),
    updatedAt: record.order.updatedAt,
    createdAt: record.createdAt,
    customerName: record.order.pickupRequest.customerUser.name ?? null,
    outletName: record.order.outlet.name,
  };
}
