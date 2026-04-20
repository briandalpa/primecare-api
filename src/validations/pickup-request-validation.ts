import { z, ZodType } from 'zod';
import { PickupStatus } from '@/generated/prisma/enums';

export type CreatePickupRequestInput = {
  addressId: string;
  scheduledAt: string;
};

export type ListPickupRequestsQuery = {
  page: number;
  limit: number;
};

export type ListMyPickupRequestsQuery = {
  page: number;
  limit: number;
  status?: PickupStatus;
};

export type PickupHistoryQuery = {
  page: number;
  limit: number;
  fromDate?: string;
  toDate?: string;
  sortBy?: 'createdAt';
  order?: 'asc' | 'desc';
};

export class PickupRequestValidation {
  static readonly CREATE: ZodType<CreatePickupRequestInput> = z.object({
    addressId: z.string().uuid(),
    scheduledAt: z.string().datetime().refine(
      (dateStr) => {
        const scheduled = new Date(dateStr);
        const now = new Date();
        // Require at least 5 minutes in the future to avoid timing edge cases
        const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);
        return scheduled > fiveMinutesLater;
      },
      { message: 'scheduledAt must be at least 5 minutes in the future' }
    ),
  });

  static readonly LIST: ZodType<ListPickupRequestsQuery> = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  });

  static readonly LIST_MY: ZodType<ListMyPickupRequestsQuery> = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    status: z.nativeEnum(PickupStatus).optional(),
  });

  static readonly HISTORY: ZodType<PickupHistoryQuery> = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
    sortBy: z.literal('createdAt').optional(),
    order: z.enum(['asc', 'desc']).optional(),
  });

  static readonly ID_PARAM: ZodType<string> = z.string().uuid();
}
