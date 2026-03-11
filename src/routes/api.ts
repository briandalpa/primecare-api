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