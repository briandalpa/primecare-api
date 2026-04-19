import { z, ZodType } from 'zod';
import { OrderStatus } from '@/generated/prisma/enums';
import type { OrderListQuery } from '@/features/orders/order-model';

export class OrderValidation {
  static readonly ID_PARAM: ZodType<{ id: string }> = z.object({
    id: z.string().uuid(),
  });

  static readonly LIST_QUERY: ZodType<OrderListQuery> = z.object({
    page:     z.coerce.number().int().min(1).default(1),
    limit:    z.coerce.number().int().min(1).max(100).default(10),
    status:          z.nativeEnum(OrderStatus).optional(),
    excludeCompleted: z.coerce.boolean().optional(),
    fromDate: z.string().date().optional(),
    toDate:   z.string().date().optional(),
    search:   z.string().optional(),
    sortBy:   z.string().default('createdAt'),
    order:    z.enum(['asc', 'desc']).default('desc'),
  }) as ZodType<OrderListQuery>;
}
