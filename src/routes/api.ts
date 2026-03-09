// Protected Routes (Authentication Required)

import express from 'express';
import { requireAuth } from '@/middleware/auth-middleware';
import { UserController } from '@/features/users/user-controller';

export const apiRouter = express.Router();

apiRouter.get('/users/me', requireAuth, UserController.getMe);
