// Protected Routes (Authentication Required)

import express from 'express';
import { requireAuth, requireStaffRole } from '@/middleware/auth-middleware';
import { UserController } from '@/features/users/user-controller';

export const apiRouter = express.Router();

// Get current user profile
apiRouter.get('/users/me', requireAuth, UserController.getMe);

// Admin - Get users (SUPER_ADMIN & OUTLET_ADMIN)
apiRouter.get(
  '/admin/users',
  requireAuth,
  requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'),
  UserController.getAdminUsers
);

// Admin - Create user (SUPER_ADMIN only)
apiRouter.post(
  '/admin/users',
  requireAuth,
  requireStaffRole('SUPER_ADMIN'),
  UserController.createAdminUser
);

// Admin - Update user (SUPER_ADMIN only)
apiRouter.patch(
  '/admin/users/:id',
  requireAuth,
  requireStaffRole('SUPER_ADMIN'),
  UserController.updateAdminUser
);

// Admin - Delete user (SUPER_ADMIN only)
apiRouter.delete(
  '/admin/users/:id',
  requireAuth,
  requireStaffRole('SUPER_ADMIN'),
  UserController.deleteAdminUser
);