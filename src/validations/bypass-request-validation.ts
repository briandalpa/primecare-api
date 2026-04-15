import { z, ZodType } from 'zod';
import type { CreateBypassRequestInput } from '@/features/bypass-requests/bypass-request-model';
import { BypassStatus } from '@/features/bypass-requests/bypass-request-model';

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

  static readonly STATUS_ENUM: ZodType<BypassStatus> = z.enum([
    BypassStatus.PENDING,
    BypassStatus.APPROVED,
    BypassStatus.REJECTED,
  ] as const) as ZodType<BypassStatus>;

  static readonly ORDER: ZodType<'asc' | 'desc'> = z.enum(['asc', 'desc']);

  static readonly APPROVE = z.object({
    password: z.string().min(1),
    problemDescription: z.string().min(1).max(500),
  });

  static readonly REJECT = z.object({
    password: z.string().min(1),
  });

  static readonly ID_PARAM: ZodType<string> = z.string().uuid();
}