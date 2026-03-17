import express from 'express';
import { requireAuth, requireStaffRole } from '@/middleware/auth-middleware';
import { UserController } from '@/features/users/user-controller';
import { AdminUserController } from '@/features/admin-users/admin-user-controller';
import { AdminOrderController } from '@/features/admin-orders/admin-order-controller';

export const apiRouter = express.Router();

apiRouter.get('/users/me', requireAuth, UserController.getMe);

apiRouter.get('/admin/users', requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'), AdminUserController.getAdminUsers);
apiRouter.get('/admin/orders', requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'), AdminOrderController.getAdminOrders);
apiRouter.get('/admin/orders/:id', requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'), AdminOrderController.getAdminOrderDetail);
apiRouter.get('/admin/pickup-requests', requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'), AdminOrderController.getAdminPickupRequests);
apiRouter.post('/admin/orders', requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'), AdminOrderController.createAdminOrder);
apiRouter.post('/admin/users', requireStaffRole('SUPER_ADMIN'), AdminUserController.createAdminUser);
apiRouter.patch('/admin/users/:id', requireStaffRole('SUPER_ADMIN'), AdminUserController.updateAdminUser);
apiRouter.delete('/admin/users/:id', requireStaffRole('SUPER_ADMIN'), AdminUserController.deleteAdminUser);

