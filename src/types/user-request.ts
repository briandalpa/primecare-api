import { Request } from 'express';
import { User } from '@/generated/prisma/client';

export interface UserRequest extends Request {
  user?: User;
}
