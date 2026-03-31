import type { PickupRequest, Outlet, Address, User } from '@/generated/prisma/client';
import { PickupStatus } from '@/generated/prisma/enums';

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
  customerId: string;
  addressId: string;
  outletId: string;
  driverId: string;
  scheduledAt: Date;
  status: PickupStatus;
  createdAt: Date;
};

export function toPickupRequestResponse(
  pickupRequest: PickupRequest & { outlet: Outlet }
): PickupRequestResponse {
  return {
    id: pickupRequest.id,
    customerId: pickupRequest.customerId,
    addressId: pickupRequest.addressId,
    scheduledAt: pickupRequest.scheduledAt,
    status: pickupRequest.status,
    createdAt: pickupRequest.createdAt,
    outlet: {
      id: pickupRequest.outlet.id,
      name: pickupRequest.outlet.name,
      address: pickupRequest.outlet.address,
      city: pickupRequest.outlet.city,
      province: pickupRequest.outlet.province,
      latitude: pickupRequest.outlet.latitude,
      longitude: pickupRequest.outlet.longitude,
    },
  };
}

export function toAcceptPickupRequestResponse(
  pickupRequest: PickupRequest & { driverId: string }
): AcceptPickupRequestResponse {
  return {
    id: pickupRequest.id,
    customerId: pickupRequest.customerId,
    addressId: pickupRequest.addressId,
    outletId: pickupRequest.outletId,
    driverId: pickupRequest.driverId,
    scheduledAt: pickupRequest.scheduledAt,
    status: pickupRequest.status,
    createdAt: pickupRequest.createdAt,
  };
}

export type AddressInfo = {
  label: string;
  street: string;
  city: string;
  province: string;
  latitude: number;
  longitude: number;
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
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function toPickupRequestListItem(
  pickupRequest: PickupRequest & { address: Address; customerUser: User }
): PickupRequestListItem {
  return {
    id: pickupRequest.id,
    customerId: pickupRequest.customerId,
    addressId: pickupRequest.addressId,
    outletId: pickupRequest.outletId,
    scheduledAt: pickupRequest.scheduledAt,
    status: pickupRequest.status,
    createdAt: pickupRequest.createdAt,
    address: {
      label: pickupRequest.address.label,
      street: pickupRequest.address.street,
      city: pickupRequest.address.city,
      province: pickupRequest.address.province,
      latitude: pickupRequest.address.latitude,
      longitude: pickupRequest.address.longitude,
    },
    customer: {
      id: pickupRequest.customerUser.id,
      name: pickupRequest.customerUser.name,
      phone: pickupRequest.customerUser.phone,
    },
  };
}
