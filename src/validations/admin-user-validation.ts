import { z, ZodType } from 'zod';
import type {
  CreateAdminUserInput,
  UpdateAdminUserInput,
} from '@/features/admin-users/admin-user-model';

const workerTypeSchema = z.enum(['WASHING', 'IRONING', 'PACKING']);

export class AdminUserValidation {
  static readonly CREATE = z
    .object({
      name: z.string().min(2),
      email: z.email(),
      role: z.enum(['OUTLET_ADMIN', 'WORKER', 'DRIVER']),
      outletId: z.string().uuid().optional(),
      workerType: workerTypeSchema.optional(),
    })
    // Custom validation: role-dependent required fields.
    // Workers and Drivers must belong to an outlet; Workers must specify their station type.
    .superRefine((data, ctx) => {
      if ((data.role === 'WORKER' || data.role === 'DRIVER') && !data.outletId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'outletId is required for WORKER and DRIVER roles',
          path: ['outletId'],
        });
      }
      if (data.role === 'WORKER' && !data.workerType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'workerType is required for WORKER role',
          path: ['workerType'],
        });
      }
    }) as ZodType<CreateAdminUserInput>;

  static readonly UPDATE: ZodType<UpdateAdminUserInput> = z.object({
    role: z.enum(['OUTLET_ADMIN', 'WORKER', 'DRIVER']).optional(),
    outletId: z.string().uuid().optional(),
    isActive: z.boolean().optional(),
    workerType: workerTypeSchema.optional(),
  });
}
