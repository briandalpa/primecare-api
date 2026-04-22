import { z, ZodType } from 'zod';
import type {
  CreateComplaintInput,
  ComplaintListQuery,
  UpdateComplaintStatusInput,
} from '@/features/complaints/complaint-model';

export class ComplaintValidation {
  static readonly CREATE: ZodType<CreateComplaintInput> = z.object({
    orderId: z.string().uuid(),
    description: z.string().min(1),
  });

  static readonly LIST: ZodType<ComplaintListQuery> = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().default(10),
    status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED']).optional(),
    outletId: z.string().uuid().optional(),
    orderId: z.string().uuid().optional(),
    sortBy: z.enum(['createdAt', 'status']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  });

  static readonly UPDATE_STATUS: ZodType<UpdateComplaintStatusInput> = z.object({
    status: z.enum(['IN_REVIEW', 'RESOLVED']),
  });

  static readonly ID_PARAM: ZodType<string> = z.string().uuid();
}
