import { z, ZodType } from 'zod';
import type {
  CreateAdminUserInput,
  UpdateAdminUserInput,
} from '@/features/admin/admin-model';

export class AdminValidation {
  static readonly CREATE: ZodType<CreateAdminUserInput> = z.object({
    name: z.string().min(2),
    email: z.email(),
    role: z.enum(['OUTLET_ADMIN', 'WORKER', 'DRIVER']),
    outletId: z.string().optional(),
  });

  static readonly UPDATE: ZodType<UpdateAdminUserInput> = z.object({
    role: z.enum(['OUTLET_ADMIN', 'WORKER', 'DRIVER']).optional(),
    outletId: z.string().optional(),
    isActive: z.boolean().optional(),
  });
}
