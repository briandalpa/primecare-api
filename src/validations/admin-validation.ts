import { z, ZodType } from 'zod';
import type {
  CreateAdminOrderInput,
  CreateAdminUserInput,
  UpdateAdminUserInput,
} from '@/features/admin/admin-model';

const workerTypeSchema = z.enum(['WASHING', 'IRONING', 'PACKING']);

export class AdminValidation {
  static readonly CREATE_ORDER: ZodType<CreateAdminOrderInput> = z.object({
    pickupRequestId: z.string().uuid(),
    pricePerKg: z.number().positive(),
    totalWeightKg: z.number().positive(),
    items: z
      .array(
        z.object({
          laundryItemId: z.string().uuid(),
          quantity: z.number().int().positive(),
        })
      )
      .min(1),
  });

  static readonly CREATE = z
    .object({
      name: z.string().min(2),
      email: z.email(),
      role: z.enum(['OUTLET_ADMIN', 'WORKER', 'DRIVER']),
      outletId: z.string().uuid().optional(),
      workerType: workerTypeSchema.optional(),
    })
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
