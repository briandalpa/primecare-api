import type { Delivery, Order, PickupRequest, Address, User } from '@/generated/prisma/client';
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
};

export type DeliveryHistoryAddress = {
  label: string;
  street: string;
  city: string;
  province: string;
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
    },
    status: delivery.status,
    deliveredAt: delivery.deliveredAt,
  };
}
