import type {
  OrderPaymentStatus,
  OrderStatus,
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

export type WorkerHistoryQuery = {
  page: number;
  limit: number;
  station?: StationType;
  date?: string;
};

export type WorkerOrderProcessItemInput = {
  laundryItemId: string;
  quantity: number;
};

export type WorkerOrderProcessInput = {
  items: WorkerOrderProcessItemInput[];
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

export type WorkerHistoryResponse = WorkerOrderResponse & {
  completedAt: Date;
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

export type WorkerOrderProcessResponse = {
  orderId: string;
  stationRecordId: string;
  station: StationType;
  stationStatus: StationStatus;
  orderStatus: OrderStatus;
  completedAt: Date;
};

export type WorkerQueueContext = Pick<Staff, 'id' | 'outletId' | 'workerType'>;
