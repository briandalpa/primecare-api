jest.mock('@/application/database', () => {
  const addressMock = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  };
  return {
    prisma: {
      address: addressMock,
      $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => unknown) =>
        cb({ address: addressMock })
      ),
    },
  };
});

import { AddressService } from '@/features/addresses/address-service';
import { ResponseError } from '@/error/response-error';
import { prisma } from '@/application/database';

const addr = prisma.address as jest.Mocked<typeof prisma.address>;

const makeAddress = (overrides: object = {}) => ({
  id: 'addr-1',
  userId: 'user-1',
  label: 'Home',
  street: '123 Main St',
  city: 'Jakarta',
  province: 'DKI Jakarta',
  latitude: -6.2,
  longitude: 106.8,
  phone: '081234567890',
  isPrimary: true,
  createdAt: new Date(),
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe('AddressService.listAddresses', () => {
  it('returns mapped addresses', async () => {
    addr.findMany.mockResolvedValue([makeAddress()]);
    const result = await AddressService.listAddresses('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Home');
  });
});

describe('AddressService.createAddress', () => {
  it('sets isPrimary true when no addresses exist', async () => {
    addr.count.mockResolvedValue(0);
    addr.create.mockResolvedValue(makeAddress({ isPrimary: true }));
    const result = await AddressService.createAddress('user-1', {
      label: 'Home', street: '1 St', city: 'Jakarta', province: 'DKI Jakarta',
      latitude: -6.2, longitude: 106.8, phone: '081234567890',
    });
    expect(result.isPrimary).toBe(true);
    expect(addr.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isPrimary: true }) })
    );
  });

  it('sets isPrimary false when addresses already exist', async () => {
    addr.count.mockResolvedValue(2);
    addr.create.mockResolvedValue(makeAddress({ isPrimary: false }));
    const result = await AddressService.createAddress('user-1', {
      label: 'Office', street: '2 St', city: 'Bekasi', province: 'Jawa Barat',
      latitude: -6.3, longitude: 107.0, phone: '081298765432',
    });
    expect(result.isPrimary).toBe(false);
  });
});

describe('AddressService.updateAddress', () => {
  it('updates address when user owns it', async () => {
    addr.findUnique.mockResolvedValue(makeAddress());
    addr.update.mockResolvedValue(makeAddress({ label: 'Updated' }));
    const result = await AddressService.updateAddress('user-1', 'addr-1', { label: 'Updated' });
    expect(result.label).toBe('Updated');
  });

  it('throws 404 when address not found', async () => {
    addr.findUnique.mockResolvedValue(null);
    await expect(AddressService.updateAddress('user-1', 'addr-x', { label: 'X' }))
      .rejects.toThrow(ResponseError);
    await expect(AddressService.updateAddress('user-1', 'addr-x', { label: 'X' }))
      .rejects.toMatchObject({ status: 404 });
  });

  it('throws 403 when user does not own address', async () => {
    addr.findUnique.mockResolvedValue(makeAddress({ userId: 'other-user' }));
    await expect(AddressService.updateAddress('user-1', 'addr-1', { label: 'X' }))
      .rejects.toMatchObject({ status: 403 });
  });
});

describe('AddressService.deleteAddress', () => {
  it('deletes address and reassigns primary when deleted address was primary', async () => {
    addr.findUnique.mockResolvedValue(makeAddress({ isPrimary: true }));
    addr.delete.mockResolvedValue({});
    addr.findFirst.mockResolvedValue(makeAddress({ id: 'addr-2', isPrimary: false }));
    addr.update.mockResolvedValue({});
    await AddressService.deleteAddress('user-1', 'addr-1');
    expect(addr.delete).toHaveBeenCalled();
    expect(addr.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isPrimary: true } })
    );
  });

  it('deletes non-primary address without reassigning', async () => {
    addr.findUnique.mockResolvedValue(makeAddress({ isPrimary: false }));
    addr.delete.mockResolvedValue({});
    await AddressService.deleteAddress('user-1', 'addr-1');
    expect(addr.delete).toHaveBeenCalled();
    expect(addr.update).not.toHaveBeenCalled();
  });

  it('deletes primary address with no remaining addresses gracefully', async () => {
    addr.findUnique.mockResolvedValue(makeAddress({ isPrimary: true }));
    addr.delete.mockResolvedValue({});
    addr.findFirst.mockResolvedValue(null);
    await AddressService.deleteAddress('user-1', 'addr-1');
    expect(addr.delete).toHaveBeenCalled();
    expect(addr.update).not.toHaveBeenCalled();
  });

  it('throws 403 when user does not own address', async () => {
    addr.findUnique.mockResolvedValue(makeAddress({ userId: 'other-user' }));
    await expect(AddressService.deleteAddress('user-1', 'addr-1'))
      .rejects.toMatchObject({ status: 403 });
  });
});

describe('AddressService.setPrimary', () => {
  it('sets address as primary and clears others', async () => {
    addr.findUnique.mockResolvedValue(makeAddress({ isPrimary: false }));
    addr.updateMany.mockResolvedValue({ count: 2 });
    addr.update.mockResolvedValue(makeAddress({ isPrimary: true }));
    const result = await AddressService.setPrimary('user-1', 'addr-1');
    expect(result.isPrimary).toBe(true);
    expect(addr.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isPrimary: false } })
    );
  });

  it('throws 404 when address not found', async () => {
    addr.findUnique.mockResolvedValue(null);
    await expect(AddressService.setPrimary('user-1', 'addr-x'))
      .rejects.toMatchObject({ status: 404 });
  });
});
