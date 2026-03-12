jest.mock('@/application/database', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    account: { findFirst: jest.fn(), create: jest.fn() },
    verification: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
  },
}));

jest.mock('@/utils/mailer', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

import { UserService } from '@/features/users/user-service';
import { ResponseError } from '@/error/response-error';
import { prisma } from '@/application/database';
import { sendEmail } from '@/utils/mailer';
import bcrypt from 'bcrypt';

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should create user when email does not exist', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com', emailVerified: false };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (prisma.verification.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.verification.create as jest.Mock).mockResolvedValue({ token: 'token-123' });
      (sendEmail as jest.Mock).mockResolvedValue(true);

      const result = await UserService.register({ name: 'John', email: 'john@example.com' });
      expect(result.id).toBe('user-1');
      expect(sendEmail).toHaveBeenCalled();
    });

    it('should throw 409 when email already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1', email: 'john@example.com' });

      await expect(UserService.register({ name: 'John', email: 'john@example.com' })).rejects.toThrow(ResponseError);
      const error = new ResponseError(409, 'Email already registered');
    });
  });

  describe('setPassword', () => {
    it('should set password when token is valid and not expired', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 3600000); // 1 hour in future
      (prisma.verification.findFirst as jest.Mock).mockResolvedValue({
        id: 'verify-1',
        identifier: 'john@example.com',
        expiresAt: futureDate,
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1', emailVerified: false });
      (prisma.account.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.account.create as jest.Mock).mockResolvedValue({ id: 'account-1' });
      (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'user-1', emailVerified: true });
      (prisma.verification.delete as jest.Mock).mockResolvedValue({});
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      const result = await UserService.setPassword({ token: 'token-123', password: 'newpass123' });
      expect(result.message).toBe('Password set successfully');
      expect(bcrypt.hash).toHaveBeenCalledWith('newpass123', expect.any(Number));
    });

    it('should throw 400 when token is expired', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 3600000); // 1 hour in past
      (prisma.verification.findFirst as jest.Mock).mockResolvedValue({
        id: 'verify-1',
        expiresAt: pastDate,
      });

      await expect(UserService.setPassword({ token: 'token-123', password: 'newpass123' })).rejects.toThrow(ResponseError);
    });

    it('should throw 409 when user already has credential account', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      (prisma.verification.findFirst as jest.Mock).mockResolvedValue({
        id: 'verify-1',
        identifier: 'john@example.com',
        expiresAt: futureDate,
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
      (prisma.account.findFirst as jest.Mock).mockResolvedValue({ id: 'account-1' });

      await expect(UserService.setPassword({ token: 'token-123', password: 'newpass123' })).rejects.toThrow(ResponseError);
    });
  });

  describe('resendVerification', () => {
    it('should silently return when user not found (security)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await UserService.resendVerification({ email: 'unknown@example.com' });
      expect(result.message).toBe('Verification email sent');
    });

    it('should throw 409 when user already verified', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
      });
      (prisma.account.findFirst as jest.Mock).mockResolvedValue({
        id: 'account-1',
        providerId: 'credential',
      });

      await expect(UserService.resendVerification({ email: 'john@example.com' })).rejects.toThrow(ResponseError);
    });

    it('should send new verification email when user exists and not verified', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
      });
      (prisma.account.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.verification.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.verification.create as jest.Mock).mockResolvedValue({ token: 'new-token' });
      (sendEmail as jest.Mock).mockResolvedValue(true);

      const result = await UserService.resendVerification({ email: 'john@example.com' });
      expect(result.message).toBe('Verification email sent');
      expect(sendEmail).toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('should return user with CUSTOMER role when no staff record', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'John',
        email: 'john@example.com',
        emailVerified: true,
        image: null,
        avatarUrl: null,
        phone: null,
        createdAt: new Date(),
        staff: null,
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.getMe('user-1');
      expect(result.role).toBe('CUSTOMER');
    });

    it('should return user with staff role when staff record exists', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Alice',
        email: 'alice@example.com',
        emailVerified: true,
        image: null,
        avatarUrl: null,
        phone: null,
        createdAt: new Date(),
        staff: { id: 'staff-1', role: 'SUPER_ADMIN', workerType: null, outletId: null, isActive: true },
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.getMe('user-1');
      expect(result.role).toBe('SUPER_ADMIN');
    });

    it('should throw 404 when user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(UserService.getMe('nonexistent')).rejects.toThrow(ResponseError);
    });
  });
});
