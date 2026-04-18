import { z, ZodType } from 'zod';
import type {
  CreateBypassRequestInput,
  ApproveBypassInput,
  RejectBypassInput,
} from '@/features/bypass-requests/bypass-request-model';

export type BypassListQuery = {
  page: number;
  limit: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  order?: 'asc' | 'desc';
};

export class BypassRequestValidation {
  static readonly CREATE: ZodType<CreateBypassRequestInput> = z.object({
    items: z
      .array(
        z.object({
          laundryItemId: z.uuid(),
          quantity: z.number().int().positive(),
        })
      )
      .min(1),
    notes: z.string().trim().min(1).max(500).optional(),
  });

  static readonly LIST: ZodType<BypassListQuery> = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().default(10),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
  });

  static readonly STATION_PARAM: ZodType<string> = z.enum(['WASHING', 'IRONING', 'PACKING']);

  static readonly APPROVE: ZodType<ApproveBypassInput> = z.object({
    password: z.string().min(1),
    problemDescription: z.string().min(1).max(500),
  });

  static readonly REJECT: ZodType<RejectBypassInput> = z.object({
    password: z.string().min(1),
  });

  static readonly ID_PARAM: ZodType<string> = z.uuid();
}
