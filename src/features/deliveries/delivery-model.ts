import type { Delivery, Order, OrderItem, LaundryItem, PickupRequest, Address, User } from '@/generated/prisma/client';
import { DeliveryStatus, OrderStatus } from '@/generated/prisma/enums';

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type DeliveryCustomerInfo = {
  id: string;
  name: string | null;
  phone: string | null;
};

export type DeliveryAddress = {
  label: string;
  street: string;
  city: string;
  province: string;
  latitude: number;
  longitude: number;
  phone: string;
};

export type DeliveryHistoryAddress = {
  label: string;
  street: string;
  city: string;
  province: string;
  phone: string;
};

export type DeliveryListItem = {
  id: string;
  orderId: string;
  customer: DeliveryCustomerInfo;
  deliveryAddress: DeliveryAddress;
  status: DeliveryStatus;
  createdAt: Date;
};

export type PaginatedDeliveryListResponse = {
  data: DeliveryListItem[];
  meta: PaginationMeta;
};

export type DeliveryAcceptResponse = {
  id: string;
  driverId: string;
  status: DeliveryStatus;
  orderStatus: OrderStatus;
};

export type DeliveryCompleteResponse = {
  id: string;
  status: DeliveryStatus;
  deliveredAt: Date;
  orderStatus: OrderStatus;
};

export type DeliveryHistoryItem = {
  id: string;
  orderId: string;
  customer: DeliveryCustomerInfo;
  deliveryAddress: DeliveryHistoryAddress;
  status: DeliveryStatus;
  deliveredAt: Date | null;
};

export type PaginatedDeliveryHistoryResponse = {
  data: DeliveryHistoryItem[];
  meta: PaginationMeta;
};

export type DeliveryOrderItem = {
  name: string;
  quantity: number;
  unitPrice: number;
};

export type DeliveryOrderSummary = {
  items: DeliveryOrderItem[];
  totalPrice: number;
  deliveryFee: number;
};

type OrderItemWithLaundryItem = OrderItem & { laundryItem: LaundryItem };
type DeliveryWithOrderSummary = Delivery & {
  order: Order & { items: OrderItemWithLaundryItem[] };
};

export function toDeliveryOrderSummary(delivery: DeliveryWithOrderSummary): DeliveryOrderSummary {
  return {
    items: delivery.order.items.map((item) => ({
      name: item.laundryItem.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? 0,
    })),
    totalPrice: delivery.order.totalPrice,
    deliveryFee: delivery.order.deliveryFee,
  };
}

type DeliveryWithOrderChain = Delivery & {
  order: Order & {
    pickupRequest: PickupRequest & {
      address: Address;
      customerUser: User;
    };
  };
};

export function toDeliveryListItem(delivery: DeliveryWithOrderChain): DeliveryListItem {
  const { address, customerUser } = delivery.order.pickupRequest;
  return {
    id: delivery.id,
    orderId: delivery.orderId,
    customer: {
      id: customerUser.id,
      name: customerUser.name,
      phone: customerUser.phone,
    },
    deliveryAddress: {
      label: address.label,
      street: address.street,
      city: address.city,
      province: address.province,
      latitude: address.latitude,
      longitude: address.longitude,
      phone: address.phone,
    },
    status: delivery.status,
    createdAt: delivery.createdAt,
  };
}

export function toDeliveryAcceptResponse(
  delivery: Delivery & { driverId: string },
  orderStatus: OrderStatus,
): DeliveryAcceptResponse {
  return {
    id: delivery.id,
    driverId: delivery.driverId,
    status: delivery.status,
    orderStatus,
  };
}

export function toDeliveryCompleteResponse(
  delivery: Delivery & { deliveredAt: Date },
  orderStatus: OrderStatus,
): DeliveryCompleteResponse {
  return {
    id: delivery.id,
    status: delivery.status,
    deliveredAt: delivery.deliveredAt,
    orderStatus,
  };
}

export function toDeliveryHistoryItem(delivery: DeliveryWithOrderChain): DeliveryHistoryItem {
  const { address, customerUser } = delivery.order.pickupRequest;
  return {
    id: delivery.id,
    orderId: delivery.orderId,
    customer: {
      id: customerUser.id,
      name: customerUser.name,
      phone: customerUser.phone,
    },
    deliveryAddress: {
      label: address.label,
      street: address.street,
      city: address.city,
      province: address.province,
      phone: address.phone,
    },
    status: delivery.status,
    deliveredAt: delivery.deliveredAt,
  };
}
