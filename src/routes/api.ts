import express from 'express';
import {
  requireAuth,
  requireCustomerAuth,
  requireStaffRole,
} from '@/middleware/auth-middleware';

import { UserController } from '@/features/users/user-controller';
import { AdminUserController } from '@/features/admin-users/admin-user-controller';
import { AdminOrderController } from '@/features/admin-orders/admin-order-controller';
import { AdminOutletController } from '@/features/admin-outlets/admin-outlet-controller';
import { AddressController } from '@/features/addresses/address-controller';
import { RegionController } from '@/features/region-data/region-controller';
import { BypassRequestController } from '@/features/bypass-requests/bypass-request-controller';
import { OrderController } from '@/features/orders/order-controller';
import { WorkerOrderController } from '@/features/worker-orders/worker-order-controller';
import { WorkerNotificationController } from '@/features/worker-notifications/worker-notification-controller';
import { PickupRequestController } from '@/features/pickup-requests/pickup-request-controller';
import { PaymentController } from '@/features/payments/payment-controller';
import { LaundryItemController } from '@/features/laundry-items/laundry-item-controller';

export const apiRouter = express.Router();

// USER
apiRouter.get('/users/me', requireAuth, UserController.getMe);

// REGION
apiRouter.get(
  '/regions/provinces',
  requireAuth,
  RegionController.listProvinces,
);
apiRouter.get(
  '/regions/cities/:provinceId',
  requireAuth,
  RegionController.listCities,
);
apiRouter.get('/regions/geocode', requireAuth, RegionController.geocode);
apiRouter.get('/regions/reverse-geocode', requireAuth, RegionController.reverseGeocode);
apiRouter.get('/laundry-items', requireAuth, LaundryItemController.list);

// ADDRESS
apiRouter.get('/users/addresses', requireCustomerAuth, AddressController.list);
apiRouter.post(
  '/users/addresses',
  requireCustomerAuth,
  AddressController.create,
);
apiRouter.patch(
  '/users/addresses/:id/primary',
  requireCustomerAuth,
  AddressController.setPrimary,
);
apiRouter.patch(
  '/users/addresses/:id',
  requireCustomerAuth,
  AddressController.update,
);
apiRouter.delete(
  '/users/addresses/:id',
  requireCustomerAuth,
  AddressController.remove,
);

// ADMIN
apiRouter.get(
  '/admin/dashboard',
  requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'),
  UserController.getDashboardStats,
);
apiRouter.get(
  '/admin/users',
  requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'),
  AdminUserController.getAdminUsers,
);
apiRouter.get(
  '/admin/orders',
  requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'),
  AdminOrderController.getAdminOrders,
);
apiRouter.get(
  '/admin/orders/:id',
  requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'),
  AdminOrderController.getAdminOrderDetail,
);
apiRouter.get(
  '/admin/pickup-requests',
  requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'),
  AdminOrderController.getAdminPickupRequests,
);
apiRouter.post(
  '/admin/orders',
  requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'),
  AdminOrderController.createAdminOrder,
);
apiRouter.post(
  '/admin/users',
  requireStaffRole('SUPER_ADMIN'),
  AdminUserController.createAdminUser,
);
apiRouter.get(
  '/admin/outlets',
  requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'),
  AdminOutletController.getAdminOutlets,
);
apiRouter.get(
  '/admin/outlets/:id',
  requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'),
  AdminOutletController.getAdminOutletDetail,
);
apiRouter.post(
  '/admin/outlets',
  requireStaffRole('SUPER_ADMIN'),
  AdminOutletController.createAdminOutlet,
);
apiRouter.patch(
  '/admin/outlets/:id',
  requireStaffRole('SUPER_ADMIN'),
  AdminOutletController.updateAdminOutlet,
);
apiRouter.delete(
  '/admin/outlets/:id',
  requireStaffRole('SUPER_ADMIN'),
  AdminOutletController.deactivateAdminOutlet,
);
apiRouter.patch(
  '/admin/users/:id',
  requireStaffRole('SUPER_ADMIN'),
  AdminUserController.updateAdminUser,
);
apiRouter.get(
  '/admin/laundry-items',
  requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'),
  AdminOrderController.getLaundryItems,
);
apiRouter.delete(
  '/admin/users/:id',
  requireStaffRole('SUPER_ADMIN'),
  AdminUserController.deleteAdminUser,
);

// PICKUP REQUEST
apiRouter.post('/pickup-requests', requireCustomerAuth, PickupRequestController.create);
apiRouter.get('/pickup-requests/my', requireCustomerAuth, PickupRequestController.listMy);
apiRouter.get('/pickup-requests/history', requireStaffRole('DRIVER'), PickupRequestController.listHistory);
apiRouter.get('/pickup-requests', requireStaffRole('DRIVER'), PickupRequestController.list);
apiRouter.patch('/pickup-requests/:id/complete', requireStaffRole('DRIVER'), PickupRequestController.complete);
apiRouter.patch('/pickup-requests/:id', requireStaffRole('DRIVER'), PickupRequestController.accept);

// BYPASS REQUEST
apiRouter.post(
  '/orders/:id/stations/:station/bypass',
  requireStaffRole('WORKER'),
  BypassRequestController.create,
);
apiRouter.get(
  '/bypass-requests',
  requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'),
  BypassRequestController.getAll,
);
apiRouter.get(
  '/bypass-requests/:id',
  requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'),
  BypassRequestController.getById,
);
apiRouter.patch(
  '/bypass-requests/:id/approve',
  requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'),
  BypassRequestController.approve,
);
apiRouter.patch(
  '/bypass-requests/:id/reject',
  requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN'),
  BypassRequestController.reject,
);

// ORDER
apiRouter.get('/orders', requireCustomerAuth, OrderController.listOrders);
apiRouter.get('/orders/:id', requireCustomerAuth, OrderController.getOrderDetail);
apiRouter.patch('/orders/:id/confirm', requireCustomerAuth, OrderController.confirmReceipt);

// PAYMENT
apiRouter.post('/orders/:id/payments', requireCustomerAuth, PaymentController.initiate);
apiRouter.post('/orders/:id/payments/verify', requireCustomerAuth, PaymentController.verify);

// WORKER
apiRouter.get(
  '/worker/history',
  requireStaffRole('WORKER'),
  WorkerOrderController.getHistory,
);
apiRouter.get(
  '/worker/orders',
  requireStaffRole('WORKER'),
  WorkerOrderController.getOrders,
);
apiRouter.get(
  '/worker/orders/:id',
  requireStaffRole('WORKER'),
  WorkerOrderController.getOrderDetail,
);
apiRouter.post(
  '/worker/orders/:id/process',
  requireStaffRole('WORKER'),
  WorkerOrderController.processOrder,
);
apiRouter.post(
  '/worker/orders/:id/bypass-request',
  requireStaffRole('WORKER'),
  BypassRequestController.createWorker,
);
apiRouter.get(
  '/worker/notifications/stream',
  requireStaffRole('WORKER'),
  WorkerNotificationController.stream,
);
