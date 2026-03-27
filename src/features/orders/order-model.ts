import { z } from 'zod';
import { OrderStatus } from '@/generated/prisma/enums';

export const CustomerOrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.nativeEnum(OrderStatus).optional(),
});

export type CustomerOrderListQuery = z.infer<typeof CustomerOrderListQuerySchema>;
