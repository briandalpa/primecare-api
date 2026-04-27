import { z, ZodType } from 'zod';
import type { CreateAdminOrderInput } from '@/features/admin-orders/admin-order-model';

export class AdminOrderValidation {
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
    manualItems: z
      .array(
        z.object({
          name: z.string().trim().min(2).max(80),
          quantity: z.number().int().positive(),
          unitPrice: z.number().positive(),
        })
      )
      .optional()
      .default([]),
  });
}
