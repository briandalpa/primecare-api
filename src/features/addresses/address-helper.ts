import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';

export type AddressClient = Pick<typeof prisma, 'address'>;

export async function findOwned(client: AddressClient, addressId: string, userId: string) {
  const address = await client.address.findUnique({ where: { id: addressId } });
  if (!address) throw new ResponseError(404, 'Address not found');
  if (address.userId !== userId) throw new ResponseError(403, 'Forbidden');
  return address;
}
