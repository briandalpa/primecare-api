// Protected Routes (Authentication Required)

import express from 'express';
import { requireAuth, requireStaffRole } from '@/middleware/auth-middleware';
import { UserController } from '@/features/users/user-controller';
import { AdminController } from '@/features/admin/admin-controller';

export const apiRouter = express.Router();

// Get current user profile
apiRouter.get('/users/me', requireAuth, UserController.getMe);

// Admin - Get users (SUPER_ADMIN & OUTLET_ADMIN)
apiRouter.get('/admin/users', requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'), AdminController.getAdminUsers);

// Admin - Create user (SUPER_ADMIN only)
apiRouter.post('/admin/users', requireStaffRole('SUPER_ADMIN'), AdminController.createAdminUser);

// Admin - Update user (SUPER_ADMIN only)
apiRouter.patch('/admin/users/:id', requireStaffRole('SUPER_ADMIN'), AdminController.updateAdminUser);

// Admin - Delete user (SUPER_ADMIN only)
apiRouter.delete('/admin/users/:id', requireStaffRole('SUPER_ADMIN'), AdminController.deleteAdminUser);
