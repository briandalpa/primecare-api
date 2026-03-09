import { Request } from 'express';
import { Staff, User } from '@/generated/prisma/client';

export interface UserRequest extends Request {
  user?: User;
  staff?: Staff;
  session?: { id: string; expiresAt: Date };
}
