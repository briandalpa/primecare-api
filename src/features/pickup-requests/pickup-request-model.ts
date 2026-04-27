import type { PickupRequest, Outlet, Address, User, Order } from '@/generated/prisma/client';
import { PickupStatus, OrderStatus } from '@/generated/prisma/enums';

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type OutletInfo = {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  latitude: number;
  longitude: number;
};

export type PickupRequestResponse = {
  id: string;
  customerId: string;
  addressId: string;
  scheduledAt: Date;
  status: PickupStatus;
  createdAt: Date;
  outlet: OutletInfo;
};

export type AcceptPickupRequestResponse = {
  id: string;
  driverId: string;
  status: PickupStatus;
  orderStatus: OrderStatus;
};

export type CompletePickupRequestResponse = {
  id: string;
  status: PickupStatus;
  orderStatus: OrderStatus;
};

function mapOutlet(outlet: Outlet): OutletInfo {
  return { id: outlet.id, name: outlet.name, address: outlet.address, city: outlet.city, province: outlet.province, latitude: outlet.latitude, longitude: outlet.longitude };
}

function mapAddressInfo(address: Address): AddressInfo {
  return { label: address.label, street: address.street, city: address.city, province: address.province, latitude: address.latitude, longitude: address.longitude, phone: address.phone };
}

function mapCustomerInfo(user: User): CustomerInfo {
  return { id: user.id, name: user.name, phone: user.phone };
}

function mapPickupAddressInfo(address: Address): PickupAddressInfo {
  return { label: address.label, street: address.street, city: address.city, phone: address.phone };
}

export function toPickupRequestResponse(pickupRequest: PickupRequest & { outlet: Outlet }): PickupRequestResponse {
  return { id: pickupRequest.id, customerId: pickupRequest.customerId, addressId: pickupRequest.addressId, scheduledAt: pickupRequest.scheduledAt, status: pickupRequest.status, createdAt: pickupRequest.createdAt, outlet: mapOutlet(pickupRequest.outlet) };
}

export function toAcceptPickupRequestResponse(
  pickupRequest: PickupRequest & { driverId: string },
  orderStatus: OrderStatus
): AcceptPickupRequestResponse {
  return {
    id: pickupRequest.id,
    driverId: pickupRequest.driverId,
    status: pickupRequest.status,
    orderStatus,
  };
}

export type AddressInfo = {
  label: string;
  street: string;
  city: string;
  province: string;
  latitude: number;
  longitude: number;
  phone: string;
};

export type CustomerInfo = {
  id: string;
  name: string | null;
  phone: string | null;
};

export type PickupRequestListItem = {
  id: string;
  customerId: string;
  addressId: string;
  outletId: string;
  scheduledAt: Date;
  status: PickupStatus;
  createdAt: Date;
  address: AddressInfo;
  customer: CustomerInfo;
};

export type PaginatedPickupRequestResponse = {
  data: PickupRequestListItem[];
  meta: PaginationMeta;
};

export function toPickupRequestListItem(pickupRequest: PickupRequest & { address: Address; customerUser: User }): PickupRequestListItem {
  return { id: pickupRequest.id, customerId: pickupRequest.customerId, addressId: pickupRequest.addressId, outletId: pickupRequest.outletId, scheduledAt: pickupRequest.scheduledAt, status: pickupRequest.status, createdAt: pickupRequest.createdAt, address: mapAddressInfo(pickupRequest.address), customer: mapCustomerInfo(pickupRequest.customerUser) };
}

export type CustomerPickupListItem = {
  id: string;
  outletName: string;
  scheduledAt: Date;
  status: PickupStatus;
  createdAt: Date;
};

export type PaginatedCustomerPickupResponse = {
  data: CustomerPickupListItem[];
  meta: PaginationMeta;
};

export function toCustomerPickupListItem(
  pickupRequest: PickupRequest & { outlet: Outlet }
): CustomerPickupListItem {
  return {
    id: pickupRequest.id,
    outletName: pickupRequest.outlet.name,
    scheduledAt: pickupRequest.scheduledAt,
    status: pickupRequest.status,
    createdAt: pickupRequest.createdAt,
  };
}

export type PickupAddressInfo = {
  label: string;
  street: string;
  city: string;
  phone: string;
};

export type PickupHistoryItem = {
  id: string;
  orderId: string | null;
  customerName: string | null;
  pickupAddress: PickupAddressInfo;
  status: PickupStatus;
  completedAt: Date;
};

export type PaginatedHistoryResponse = {
  data: PickupHistoryItem[];
  meta: PaginationMeta;
};

export function toPickupHistoryItem(pickupRequest: PickupRequest & { address: Address; customerUser: User; order: Order | null; updatedAt: Date }): PickupHistoryItem {
  return { id: pickupRequest.id, orderId: pickupRequest.order?.id ?? null, customerName: pickupRequest.customerUser.name, pickupAddress: mapPickupAddressInfo(pickupRequest.address), status: pickupRequest.status, completedAt: pickupRequest.updatedAt };
}
