jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((headers: Record<string, string | string[] | undefined>) => headers),
}));

jest.mock('@/application/database', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    staff: { findUnique: jest.fn() },
  },
}));

jest.mock('@/utils/auth', () => ({
  auth: {
    api: { getSession: jest.fn() },
  },
}));

import { requireAuth, requireStaffAuth, requireStaffRole } from '@/middleware/auth-middleware';
import { prisma } from '@/application/database';
import { auth } from '@/utils/auth';
import { Response, NextFunction } from 'express';
import type { UserRequest } from '@/types/user-request';

describe('Auth Middleware', () => {
  let req: Partial<UserRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('should return 401 when no session exists', async () => {
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue(null);
      await requireAuth(req as UserRequest, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should attach user to request when session exists', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      const mockSession = { session: 'token-123' };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser, session: mockSession });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await requireAuth(req as UserRequest, res as Response, next);
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 when user not found in database', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await requireAuth(req as UserRequest, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireStaffAuth', () => {
    it('should return 401 when no session exists', async () => {
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue(null);
      await requireStaffAuth(req as UserRequest, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 when staff record does not exist', async () => {
      const mockUser = { id: 'user-1', name: 'John', email: 'john@example.com' };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(null);

      await requireStaffAuth(req as UserRequest, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 403 when staff is inactive', async () => {
      const mockUser = { id: 'user-1' };
      const mockStaff = { id: 'staff-1', userId: 'user-1', isActive: false, role: 'WORKER' };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      await requireStaffAuth(req as UserRequest, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should attach staff to request when staff exists and is active', async () => {
      const mockUser = { id: 'user-1', name: 'Alice' };
      const mockStaff = { id: 'staff-1', userId: 'user-1', isActive: true, role: 'OUTLET_ADMIN' };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      await requireStaffAuth(req as UserRequest, res as Response, next);
      expect(req.staff).toEqual(mockStaff);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireStaffRole', () => {
    it('should return 401 when no session exists', async () => {
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue(null);
      const middleware = requireStaffRole('SUPER_ADMIN');

      await middleware(req as UserRequest, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 when staff record does not exist', async () => {
      const mockUser = { id: 'user-1' };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(null);

      const middleware = requireStaffRole('SUPER_ADMIN');
      await middleware(req as UserRequest, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 403 when staff is inactive', async () => {
      const mockUser = { id: 'user-1' };
      const mockStaff = { id: 'staff-1', userId: 'user-1', isActive: false, role: 'WORKER' };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const middleware = requireStaffRole('SUPER_ADMIN');
      await middleware(req as UserRequest, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 403 when user role not in allowed roles', async () => {
      const mockUser = { id: 'user-1' };
      const mockStaff = { id: 'staff-1', userId: 'user-1', isActive: true, role: 'WORKER' };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const middleware = requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN');
      await middleware(req as UserRequest, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should allow access when user role is SUPER_ADMIN', async () => {
      const mockUser = { id: 'user-1' };
      const mockStaff = { id: 'staff-1', userId: 'user-1', isActive: true, role: 'SUPER_ADMIN' };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const middleware = requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN');
      await middleware(req as UserRequest, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow OUTLET_ADMIN with multiple allowed roles', async () => {
      const mockUser = { id: 'user-1' };
      const mockStaff = { id: 'staff-1', userId: 'user-1', isActive: true, role: 'OUTLET_ADMIN' };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const middleware = requireStaffRole('OUTLET_ADMIN', 'WORKER');
      await middleware(req as UserRequest, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow WORKER role', async () => {
      const mockUser = { id: 'user-1' };
      const mockStaff = { id: 'staff-1', userId: 'user-1', isActive: true, role: 'WORKER' };
      (auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: mockUser });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const middleware = requireStaffRole('WORKER', 'DRIVER');
      await middleware(req as UserRequest, res as Response, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
