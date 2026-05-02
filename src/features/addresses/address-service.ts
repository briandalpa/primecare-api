import { prisma } from '@/application/database';
import {
  CreateAddressInput,
  UpdateAddressInput,
  toAddressResponse,
} from './address-model';
import { findOwned } from './address-helper';

export class AddressService {

  static async listAddresses(userId: string) {
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return addresses.map(toAddressResponse);
  }

  static async createAddress(userId: string, data: CreateAddressInput) {
    return prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId } });
      const address = await tx.address.create({
        data: { userId, ...data, isPrimary: count === 0 },
      });
      return toAddressResponse(address);
    });
  }

  static async updateAddress(userId: string, addressId: string, data: UpdateAddressInput) {
    return prisma.$transaction(async (tx) => {
      await findOwned(tx, addressId, userId);
      const updated = await tx.address.update({ where: { id: addressId }, data });
      return toAddressResponse(updated);
    });
  }

  static async deleteAddress(userId: string, addressId: string) {
    await prisma.$transaction(async (tx) => {
      const address = await findOwned(tx, addressId, userId);
      await tx.address.delete({ where: { id: addressId } });
      if (address.isPrimary) {
        const oldest = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
        if (oldest) await tx.address.update({ where: { id: oldest.id }, data: { isPrimary: true } });
      }
    });
  }

  static async setPrimary(userId: string, addressId: string) {
    return prisma.$transaction(async (tx) => {
      await findOwned(tx, addressId, userId);
      await tx.address.updateMany({ where: { userId }, data: { isPrimary: false } });
      const updated = await tx.address.update({ where: { id: addressId }, data: { isPrimary: true } });
      return toAddressResponse(updated);
    });
  }
}
