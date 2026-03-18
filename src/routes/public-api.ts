import { UserController } from '@/features/users/user-controller';
import express from 'express';

export const publicRouter = express.Router();

publicRouter.post('/users/register', UserController.register);
publicRouter.post('/users/set-password', UserController.setPassword);
publicRouter.post('/users/resend-verification', UserController.resendVerification);
