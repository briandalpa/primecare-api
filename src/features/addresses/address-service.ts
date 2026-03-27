import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import {
  CreateAddressInput,
  UpdateAddressInput,
  toAddressResponse,
} from './address-model';

type AddressClient = Pick<typeof prisma, 'address'>;

export class AddressService {
  private static async findOwned(client: AddressClient, addressId: string, userId: string) {
    const address = await client.address.findUnique({ where: { id: addressId } });
    if (!address) throw new ResponseError(404, 'Address not found');
    if (address.userId !== userId) throw new ResponseError(403, 'Forbidden');
    return address;
  }

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
      await AddressService.findOwned(tx, addressId, userId);
      const updated = await tx.address.update({ where: { id: addressId }, data });
      return toAddressResponse(updated);
    });
  }

  static async deleteAddress(userId: string, addressId: string) {
    await prisma.$transaction(async (tx) => {
      const address = await AddressService.findOwned(tx, addressId, userId);
      await tx.address.delete({ where: { id: addressId } });
      if (address.isPrimary) {
        const oldest = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
        if (oldest) await tx.address.update({ where: { id: oldest.id }, data: { isPrimary: true } });
      }
    });
  }

  static async setPrimary(userId: string, addressId: string) {
    return prisma.$transaction(async (tx) => {
      await AddressService.findOwned(tx, addressId, userId);
      await tx.address.updateMany({ where: { userId }, data: { isPrimary: false } });
      const updated = await tx.address.update({ where: { id: addressId }, data: { isPrimary: true } });
      return toAddressResponse(updated);
    });
  }
}
