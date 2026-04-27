import { z, ZodType } from 'zod';
import { DeliveryStatus } from '@/generated/prisma/enums';

export type DeliveryListQuery = {
  page: number;
  limit: number;
  status: DeliveryStatus;
};

export type DeliveryHistoryQuery = {
  page: number;
  limit: number;
  fromDate?: string;
  toDate?: string;
  sortBy: 'deliveredAt';
  order: 'asc' | 'desc';
};

export class DeliveryValidation {
  static readonly LIST: ZodType<DeliveryListQuery> = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    status: z.nativeEnum(DeliveryStatus).default(DeliveryStatus.PENDING),
  });

  static readonly HISTORY: ZodType<DeliveryHistoryQuery> = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
    sortBy: z.literal('deliveredAt').default('deliveredAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  });

  static readonly ID_PARAM: ZodType<string> = z.string().uuid();
}
