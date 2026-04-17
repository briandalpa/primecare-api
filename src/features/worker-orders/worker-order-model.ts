import type {
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
  Staff,
  StationStatus,
  StationType,
} from '@/generated/prisma/client';

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

export type WorkerOrderItemResponse = {
  laundryItemId: string;
  itemName: string;
  quantity: number;
};

export type WorkerOrderDetailResponse = {
  orderId: string;
  stationRecordId: string;
  station: StationType;
  previousStation: StationType | null;
  stationStatus: StationStatus;
  orderStatus: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  totalItems: number;
  customerName: string | null;
  outletName: string;
  createdAt: Date;
  updatedAt: Date;
  referenceItems: WorkerOrderItemResponse[];
  stationItems: WorkerOrderItemResponse[];
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

export function toWorkerOrderDetailResponse(
  record: WorkerOrderDetailRecord,
  referenceItems: WorkerOrderItemResponse[],
): WorkerOrderDetailResponse {
  return {
    orderId: record.orderId,
    stationRecordId: record.id,
    station: record.station,
    previousStation: getPreviousStation(record.station),
    stationStatus: record.status,
    orderStatus: record.order.status,
    paymentStatus: record.order.paymentStatus,
    totalItems: record.order.items.reduce(
      (total, item) => total + item.quantity,
      0,
    ),
    customerName: record.order.pickupRequest.customerUser.name ?? null,
    outletName: record.order.outlet.name,
    createdAt: record.createdAt,
    updatedAt: record.order.updatedAt,
    referenceItems,
    stationItems: record.stationItems.map(toWorkerOrderItemResponse),
  };
}
