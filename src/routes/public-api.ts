import { UserController } from '@/features/users/user-controller';
import { PaymentController } from '@/features/payments/payment-controller';
import express from 'express';

export const publicRouter = express.Router();

publicRouter.post('/users/register', UserController.register);
publicRouter.post('/users/set-password', UserController.setPassword);
publicRouter.post('/users/resend-verification', UserController.resendVerification);

publicRouter.post('/payments/webhook', PaymentController.handleWebhook);
