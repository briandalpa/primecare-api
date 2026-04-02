import { OrderPaymentStatus, OrderStatus } from '@/generated/prisma/enums';

export type OrderListQuery = {
  page: number;
  limit: number;
  status?: OrderStatus;
  fromDate?: string;
  toDate?: string;
  search?: string;
  sortBy: string;
  order: 'asc' | 'desc';
};

export type OrderListItem = {
  id: string;
  outletName: string;
  customerName: string;
  totalPrice: number;
  paymentStatus: OrderPaymentStatus;
  status: OrderStatus;
  createdAt: Date;
};

export type OrderItemDetail = {
  id: string;
  laundryItemId: string;
  itemName: string;
  quantity: number;
};

export type StationRecordDetail = {
  id: string;
  station: string;
  workerName: string;
  status: string;
  completedAt: Date | null;
  createdAt: Date;
};

export type PaymentDetail = {
  id: string;
  amount: number;
  gateway: string;
  status: string;
  paidAt: Date | null;
};

export type DeliveryDetail = {
  id: string;
  status: string;
  deliveredAt: Date | null;
  createdAt: Date;
};

export type OrderDetailResponse = {
  id: string;
  outletId: string;
  outletName: string;
  customerName: string;
  totalWeightKg: number;
  pricePerKg: number;
  totalPrice: number;
  paymentStatus: OrderPaymentStatus;
  status: OrderStatus;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItemDetail[];
  stationRecords: StationRecordDetail[];
  payment: PaymentDetail | null;
  delivery: DeliveryDetail | null;
};

export const toOrderListItem = (order: {
  id: string;
  outlet: { name: string };
  pickupRequest: { customerUser: { name: string | null } };
  totalPrice: number;
  paymentStatus: OrderPaymentStatus;
  status: OrderStatus;
  createdAt: Date;
}): OrderListItem => ({
  id:            order.id,
  outletName:    order.outlet.name,
  customerName:  order.pickupRequest.customerUser.name ?? '',
  totalPrice:    order.totalPrice,
  paymentStatus: order.paymentStatus,
  status:        order.status,
  createdAt:     order.createdAt,
});

export const toOrderDetail = (order: {
  id: string;
  outletId: string;
  outlet: { name: string };
  pickupRequest: { customerUser: { name: string | null } };
  totalWeightKg: number;
  pricePerKg: number;
  totalPrice: number;
  paymentStatus: OrderPaymentStatus;
  status: OrderStatus;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: { id: string; laundryItemId: string; laundryItem: { name: string }; quantity: number }[];
  stationRecords: {
    id: string;
    station: string;
    staff: { user: { name: string | null } };
    status: string;
    completedAt: Date | null;
    createdAt: Date;
  }[];
  payment: { id: string; amount: number; gateway: string; status: string; paidAt: Date | null } | null;
  delivery: { id: string; status: string; deliveredAt: Date | null; createdAt: Date } | null;
}): OrderDetailResponse => ({
  id:            order.id,
  outletId:      order.outletId,
  outletName:    order.outlet.name,
  customerName:  order.pickupRequest.customerUser.name ?? '',
  totalWeightKg: order.totalWeightKg,
  pricePerKg:    order.pricePerKg,
  totalPrice:    order.totalPrice,
  paymentStatus: order.paymentStatus,
  status:        order.status,
  confirmedAt:   order.confirmedAt,
  createdAt:     order.createdAt,
  updatedAt:     order.updatedAt,
  items: order.items.map((item) => ({
    id:            item.id,
    laundryItemId: item.laundryItemId,
    itemName:      item.laundryItem.name,
    quantity:      item.quantity,
  })),
  stationRecords: order.stationRecords.map((sr) => ({
    id:          sr.id,
    station:     sr.station,
    workerName:  sr.staff.user.name ?? '',
    status:      sr.status,
    completedAt: sr.completedAt,
    createdAt:   sr.createdAt,
  })),
  payment:  order.payment ? {
    id:      order.payment.id,
    amount:  order.payment.amount,
    gateway: order.payment.gateway,
    status:  order.payment.status,
    paidAt:  order.payment.paidAt,
  } : null,
  delivery: order.delivery ? {
    id:          order.delivery.id,
    status:      order.delivery.status,
    deliveredAt: order.delivery.deliveredAt,
    createdAt:   order.delivery.createdAt,
  } : null,
});
