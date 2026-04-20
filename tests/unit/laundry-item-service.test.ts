jest.mock('@/application/database', () => ({
  prisma: {
    laundryItem: { findMany: jest.fn() },
  },
}));

import { prisma } from '@/application/database';
import { LaundryItemService } from '@/features/laundry-items/laundry-item-service';

describe('LaundryItemService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists active laundry items ordered by name', async () => {
    const items = [{ id: '1', name: 'Shirt', slug: 'shirt' }];
    (prisma.laundryItem.findMany as jest.Mock).mockResolvedValue(items);

    await expect(LaundryItemService.listActive()).resolves.toEqual(items);
    expect(prisma.laundryItem.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  });
});
