import { z, type ZodType } from 'zod';
import type { CreateShiftInput, ShiftListQuery } from '@/features/shifts/shift-model';

const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');

export class ShiftValidation {
  static readonly ID_PARAM: ZodType<string> = z.uuid();

  static readonly CREATE: ZodType<CreateShiftInput> = z.object({
    staffId: z.uuid(),
    startedAt: z.string().datetime(),
  });

  static readonly LIST: ZodType<ShiftListQuery> = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    staffId: z.uuid().optional(),
    outletId: z.uuid().optional(),
    isActive: booleanQuery.optional(),
  });
}