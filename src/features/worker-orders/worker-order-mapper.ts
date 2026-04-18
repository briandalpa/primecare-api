import type {
  OrderStatus,
  Prisma,
  StationStatus,
  StationType,
} from '@/generated/prisma/client';
import type {
  WorkerHistoryResponse,
  WorkerOrderDetailResponse,
  WorkerOrderItemResponse,
  WorkerOrderProcessResponse,
  WorkerOrderResponse,
} from './worker-order-model';

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

type WorkerOrderDetailRecord = Prisma.StationRecordGetPayload<{
  include: {
    stationItems: {
      include: {
        laundryItem: {
          select: {
            name: true;
          };
        };
      };
    };
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

const getPreviousStation = (station: StationType): StationType | null => {
  if (station === 'WASHING') return null;
  if (station === 'IRONING') return 'WASHING';
  return 'IRONING';
};

const toWorkerOrderItemResponse = (
  item: { laundryItemId: string; quantity: number; laundryItem: { name: string } },
): WorkerOrderItemResponse => ({
  laundryItemId: item.laundryItemId,
  itemName: item.laundryItem.name,
  quantity: item.quantity,
});

export const toWorkerOrderResponse = (
  record: WorkerOrderRecord,
): WorkerOrderResponse => ({
  id: record.id,
  orderId: record.orderId,
  station: record.station,
  status: record.status,
  totalItems: record.order.items.reduce((total, item) => total + item.quantity, 0),
  updatedAt: record.order.updatedAt,
  createdAt: record.createdAt,
  customerName: record.order.pickupRequest.customerUser.name ?? null,
  outletName: record.order.outlet.name,
});

export const toWorkerHistoryResponse = (
  record: WorkerOrderRecord,
): WorkerHistoryResponse => {
  if (!record.completedAt) {
    throw new Error(
      'Invariant: completedAt must be set when returning worker history',
    );
  }

  return {
    ...toWorkerOrderResponse(record),
    completedAt: record.completedAt,
  };
};

export const toWorkerOrderDetailResponse = (
  record: WorkerOrderDetailRecord,
  referenceItems: WorkerOrderItemResponse[],
): WorkerOrderDetailResponse => ({
  orderId: record.orderId,
  stationRecordId: record.id,
  station: record.station,
  previousStation: getPreviousStation(record.station),
  stationStatus: record.status,
  orderStatus: record.order.status,
  paymentStatus: record.order.paymentStatus,
  totalItems: record.order.items.reduce((total, item) => total + item.quantity, 0),
  customerName: record.order.pickupRequest.customerUser.name ?? null,
  outletName: record.order.outlet.name,
  createdAt: record.createdAt,
  updatedAt: record.order.updatedAt,
  referenceItems,
  stationItems: record.stationItems.map(toWorkerOrderItemResponse),
});

export const toWorkerOrderProcessResponse = (
  record: {
    id: string;
    orderId: string;
    station: StationType;
    status: StationStatus;
    completedAt: Date | null;
  },
  orderStatus: OrderStatus,
): WorkerOrderProcessResponse => {
  if (!record.completedAt) {
    throw new Error('Invariant: completedAt must be set when processing succeeds');
  }

  return {
    orderId: record.orderId,
    stationRecordId: record.id,
    station: record.station,
    stationStatus: record.status,
    orderStatus,
    completedAt: record.completedAt,
  };
};
