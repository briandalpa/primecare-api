import express from 'express';
import { requireAuth, requireCustomerAuth, requireStaffRole } from '@/middleware/auth-middleware';
import { UserController } from '@/features/users/user-controller';
import { AdminUserController } from '@/features/admin-users/admin-user-controller';
import { AdminOrderController } from '@/features/admin-orders/admin-order-controller';
import { OrderController } from '@/features/orders/order-controller';
import { AddressController } from '@/features/addresses/address-controller';
import { RegionController } from '@/features/region-data/region-controller';
import { BypassRequestController } from '@/features/bypass-requests/bypass-request-controller';

export const apiRouter = express.Router();

apiRouter.get('/users/me', requireAuth, UserController.getMe);

apiRouter.get('/regions/provinces', requireAuth, RegionController.listProvinces);
apiRouter.get('/regions/cities/:provinceId', requireAuth, RegionController.listCities);
apiRouter.get('/regions/geocode', requireAuth, RegionController.geocode);

apiRouter.get('/users/addresses', requireCustomerAuth, AddressController.list);
apiRouter.post('/users/addresses', requireCustomerAuth, AddressController.create);
apiRouter.patch('/users/addresses/:id/primary', requireCustomerAuth, AddressController.setPrimary);
apiRouter.patch('/users/addresses/:id', requireCustomerAuth, AddressController.update);
apiRouter.delete('/users/addresses/:id', requireCustomerAuth, AddressController.remove);

apiRouter.get('/admin/dashboard', requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'), UserController.getDashboardStats);
apiRouter.get('/admin/users', requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'), AdminUserController.getAdminUsers);
apiRouter.get('/admin/orders', requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'), AdminOrderController.getAdminOrders);
apiRouter.get('/admin/orders/:id', requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'), AdminOrderController.getAdminOrderDetail);
apiRouter.get('/admin/pickup-requests', requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'), AdminOrderController.getAdminPickupRequests);
apiRouter.post('/admin/orders', requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'), AdminOrderController.createAdminOrder);
apiRouter.post('/admin/users', requireStaffRole('SUPER_ADMIN'), AdminUserController.createAdminUser);
apiRouter.patch('/admin/users/:id', requireStaffRole('SUPER_ADMIN'), AdminUserController.updateAdminUser);
apiRouter.get('/admin/laundry-items', requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'), AdminOrderController.getLaundryItems);
apiRouter.delete('/admin/users/:id', requireStaffRole('SUPER_ADMIN'), AdminUserController.deleteAdminUser);

apiRouter.get('/orders', requireCustomerAuth, OrderController.listOrders);
apiRouter.get('/orders/:id', requireCustomerAuth, OrderController.getOrderDetail);
apiRouter.post('/orders/:id/confirm', requireCustomerAuth, OrderController.confirmReceipt);

apiRouter.patch( "/admin/bypass-requests/:id/reject", requireStaffRole("SUPER_ADMIN", "OUTLET_ADMIN"), BypassRequestController.reject );
apiRouter.get( "/admin/bypass-requests", requireStaffRole("SUPER_ADMIN", "OUTLET_ADMIN"), BypassRequestController.findAll);