import { z, ZodType } from 'zod';
import type {
  WorkerOrderListQuery,
  WorkerOrderProcessInput,
} from '@/features/worker-orders/worker-order-model';

export class WorkerOrderValidation {
  static readonly ID_PARAM: ZodType<string> = z.uuid();

  static readonly PROCESS: ZodType<WorkerOrderProcessInput> = z.object({
    items: z
      .array(
        z.object({
          laundryItemId: z.uuid(),
          quantity: z.number().int().positive(),
        }),
      )
      .min(1),
  });

  static readonly LIST: ZodType<WorkerOrderListQuery> = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    status: z.enum(['IN_PROGRESS', 'BYPASS_REQUESTED', 'COMPLETED']).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  });
}
