import type { PickupRequest, Delivery, Order, Address, User } from '@/generated/prisma/client';

export type DriverActivePickupTask = {
  type: 'pickup';
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  address: { label: string; street: string; city: string };
};

export type DriverActiveDeliveryTask = {
  type: 'delivery';
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  address: { label: string; street: string; city: string; province: string; phone: string };
};

export type DriverActiveTaskResponse = DriverActivePickupTask | DriverActiveDeliveryTask | null;

type PickupWithAddress = PickupRequest & { address: Address; customerUser: User };

type DeliveryWithOrderChain = Delivery & {
  order: Order & {
    pickupRequest: PickupRequest & { address: Address; customerUser: User };
  };
};

export function toDriverActivePickupTask(pickup: PickupWithAddress): DriverActivePickupTask {
  return {
    type: 'pickup',
    id: pickup.id,
    customerName: pickup.customerUser.name,
    customerPhone: pickup.address.phone ?? pickup.customerUser.phone,
    address: {
      label: pickup.address.label,
      street: pickup.address.street,
      city: pickup.address.city,
    },
  };
}

export function toDriverActiveDeliveryTask(delivery: DeliveryWithOrderChain): DriverActiveDeliveryTask {
  const { address, customerUser } = delivery.order.pickupRequest;
  return {
    type: 'delivery',
    id: delivery.id,
    customerName: customerUser.name,
    customerPhone: address.phone ?? customerUser.phone,
    address: { label: address.label, street: address.street, city: address.city, province: address.province, phone: address.phone },
  };
}
