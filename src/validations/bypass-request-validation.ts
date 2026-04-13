import { z, ZodType } from 'zod';
import type { CreateBypassRequestInput } from '@/features/bypass-requests/bypass-request-model';

export class BypassRequestValidation {
  static readonly CREATE: ZodType<CreateBypassRequestInput> = z.object({
    items: z.array(
      z.object({
        laundryItemId: z.string().uuid(),
        quantity: z.number().int().positive(),
      })
    ).min(1),
  });

  static readonly STATION_PARAM: ZodType<string> = z.enum(['WASHING', 'IRONING', 'PACKING']);
}