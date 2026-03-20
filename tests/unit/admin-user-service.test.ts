jest.mock('@/application/database', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    staff: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
    verification: { create: jest.fn(), deleteMany: jest.fn() },
    // deleteAdminUser wraps staff + user delete in a transaction; execute all ops sequentially.
    $transaction: jest.fn().mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

jest.mock('@/utils/mailer', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

import { AdminUserService } from '@/features/admin-users/admin-user-service';
import { prisma } from '@/application/database';
import { sendEmail } from '@/utils/mailer';

const defaultQuery = { page: 1, limit: 10 };

describe('AdminUserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAdminUsers', () => {
    it('should return all users for SUPER_ADMIN with correct structure', async () => {
      const mockUsers = [
        { id: 'user-1', name: 'Alice', email: 'alice@example.com', emailVerified: false, createdAt: new Date(), staff: { role: 'OUTLET_ADMIN', outletId: null, isActive: true, workerType: null } },
        { id: 'user-2', name: 'Bob', email: 'bob@example.com', emailVerified: false, createdAt: new Date(), staff: { role: 'WORKER', outletId: 'outlet-1', isActive: true, workerType: 'WASHING' } },
      ];
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.count as jest.Mock).mockResolvedValue(2);

      const result = await AdminUserService.getAdminUsers({ role: 'SUPER_ADMIN', outletId: null }, defaultQuery);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).toHaveProperty('email');
      expect(result.data[0]).toHaveProperty('role');
      expect(result.meta).toHaveProperty('total', 2);
    });

    it('should return only outlet users for OUTLET_ADMIN', async () => {
      const mockUsers = [{ id: 'user-1', name: 'Charlie', email: 'charlie@example.com', emailVerified: false, createdAt: new Date(), staff: { role: 'WORKER', outletId: 'outlet-1', isActive: true, workerType: 'IRONING' } }];
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      const result = await AdminUserService.getAdminUsers({ role: 'OUTLET_ADMIN', outletId: 'outlet-1' }, defaultQuery);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.id).toBe('user-1');
      expect(result.data[0]!.email).toBe('charlie@example.com');
    });

    it('should throw 403 for WORKER role', async () => {
      const mockStaff = { role: 'WORKER' as const, outletId: null };

      await expect(AdminUserService.getAdminUsers(mockStaff, defaultQuery)).rejects.toMatchObject({ status: 403 });
    });

    it('should throw 403 for DRIVER role', async () => {
      const mockStaff = { role: 'DRIVER' as const, outletId: null };

      await expect(AdminUserService.getAdminUsers(mockStaff, defaultQuery)).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('createAdminUser', () => {
    it('should create new admin user with invite email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'user-new',
        name: 'Charlie',
        email: 'charlie@example.com',
      });
      (prisma.staff.create as jest.Mock).mockResolvedValue({
        id: 'staff-new',
        userId: 'user-new',
        role: 'OUTLET_ADMIN',
      });
      (prisma.verification.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.verification.create as jest.Mock).mockResolvedValue({ token: 'invite-token' });
      (sendEmail as jest.Mock).mockResolvedValue(true);

      const result = await AdminUserService.createAdminUser({
        name: 'Charlie',
        email: 'charlie@example.com',
        role: 'OUTLET_ADMIN',
        outletId: 'outlet-1',
      });

      expect(result.id).toBe('user-new');
      expect(result.email).toBe('charlie@example.com');
      expect(sendEmail).toHaveBeenCalled();
    });

    it('should throw 409 when email already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });

      await expect(
        AdminUserService.createAdminUser({
          name: 'Charlie',
          email: 'charlie@example.com',
          role: 'WORKER',
        })
      ).rejects.toMatchObject({ status: 409 });
    });

    it('should create DRIVER with outletId', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'user-driver',
        name: 'David',
        email: 'david@example.com',
      });
      (prisma.staff.create as jest.Mock).mockResolvedValue({
        id: 'staff-driver',
        userId: 'user-driver',
        role: 'DRIVER',
        outletId: 'outlet-1',
      });
      (prisma.verification.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.verification.create as jest.Mock).mockResolvedValue({ token: 'token' });
      (sendEmail as jest.Mock).mockResolvedValue(true);

      const result = await AdminUserService.createAdminUser({
        name: 'David',
        email: 'david@example.com',
        role: 'DRIVER',
        outletId: 'outlet-1',
      });

      expect(result.role).toBe('DRIVER');
      expect(prisma.staff.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ outletId: 'outlet-1' }) }));
    });
  });

  describe('updateAdminUser', () => {
    it('should update staff record with new role', async () => {
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue({
        id: 'staff-1',
        userId: 'user-1',
        role: 'WORKER',
        outletId: 'outlet-1',
        isActive: true,
        workerType: null,
      });
      (prisma.staff.update as jest.Mock).mockResolvedValue({
        id: 'staff-1',
        userId: 'user-1',
        role: 'OUTLET_ADMIN',
        outletId: 'outlet-1',
        isActive: true,
      });

      const result = await AdminUserService.updateAdminUser('user-1', { role: 'OUTLET_ADMIN' });
      expect(result.role).toBe('OUTLET_ADMIN');
    });

    it('should throw 404 when staff not found', async () => {
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(AdminUserService.updateAdminUser('nonexistent', { role: 'WORKER' })).rejects.toMatchObject({ status: 404 });
    });

    it('should update isActive status', async () => {
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue({
        id: 'staff-1',
        userId: 'user-1',
        role: 'WORKER',
        outletId: null,
        isActive: true,
        workerType: null,
      });
      (prisma.staff.update as jest.Mock).mockResolvedValue({
        id: 'staff-1',
        userId: 'user-1',
        role: 'WORKER',
        outletId: null,
        isActive: false,
      });

      const result = await AdminUserService.updateAdminUser('user-1', { isActive: false });
      expect(result.isActive).toBe(false);
    });

    it('should preserve existing values for partial update', async () => {
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue({
        id: 'staff-1',
        userId: 'user-1',
        role: 'WORKER',
        outletId: 'outlet-1',
        isActive: true,
        workerType: 'WASHING',
      });
      (prisma.staff.update as jest.Mock).mockResolvedValue({
        id: 'staff-1',
        userId: 'user-1',
        role: 'WORKER',
        outletId: 'outlet-2',
        isActive: true,
      });

      const result = await AdminUserService.updateAdminUser('user-1', { outletId: 'outlet-2' });
      expect(result.role).toBe('WORKER');
      expect(result.outletId).toBe('outlet-2');
      expect(result.isActive).toBe(true);
    });
  });

  describe('deleteAdminUser', () => {
    it('should delete staff and user records', async () => {
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue({
        id: 'staff-1',
        userId: 'user-1',
      });
      (prisma.staff.delete as jest.Mock).mockResolvedValue({ id: 'staff-1' });
      (prisma.user.delete as jest.Mock).mockResolvedValue({ id: 'user-1' });

      await AdminUserService.deleteAdminUser('user-1');
      expect(prisma.staff.delete).toHaveBeenCalled();
      expect(prisma.user.delete).toHaveBeenCalled();
    });

    it('should throw 404 when staff not found', async () => {
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(AdminUserService.deleteAdminUser('nonexistent')).rejects.toMatchObject({ status: 404 });
    });

    it('should call both staff and user delete', async () => {
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });
      (prisma.staff.delete as jest.Mock).mockResolvedValue({ id: 'staff-1' });
      (prisma.user.delete as jest.Mock).mockResolvedValue({ id: 'user-1' });

      await AdminUserService.deleteAdminUser('user-1');
      expect(prisma.staff.delete).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });
  });
});
