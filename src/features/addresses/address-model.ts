import type { Address } from '@/generated/prisma/client';

export type CreateAddressInput = {
  label: string;
  street: string;
  city: string;
  province: string;
  latitude: number;
  longitude: number;
  phone: string;
};

export type UpdateAddressInput = {
  label?: string;
  street?: string;
  city?: string;
  province?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
};

export type AddressResponse = {
  id: string;
  userId: string;
  label: string;
  street: string;
  city: string;
  province: string;
  latitude: number;
  longitude: number;
  phone: string;
  isPrimary: boolean;
  createdAt: Date;
};

export function toAddressResponse(address: Address): AddressResponse {
  return {
    id: address.id,
    userId: address.userId,
    label: address.label,
    street: address.street,
    city: address.city,
    province: address.province,
    latitude: address.latitude,
    longitude: address.longitude,
    phone: address.phone,
    isPrimary: address.isPrimary,
    createdAt: address.createdAt,
  };
}
