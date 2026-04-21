import { prisma } from '@/application/database';
import { LaundryItemListItem } from './laundry-item-model';

export class LaundryItemService {
  static async listActive(): Promise<LaundryItemListItem[]> {
    return prisma.laundryItem.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }
}
