import { z, ZodType } from 'zod'
import {
  CreateAdminOutletInput,
  GetAdminOutletsQuery,
  UpdateAdminOutletInput,
} from '@/features/admin-outlets/admin-outlet-model'

export class AdminOutletValidation {
  static readonly PARAMS = z.object({ id: z.string().uuid() })

  static readonly QUERY: ZodType<GetAdminOutletsQuery> = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().min(1).optional(),
    isActive: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((value) => value === 'true')])
      .optional(),
    sortBy: z.enum(['createdAt', 'name', 'city', 'province']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })

  static readonly CREATE: ZodType<CreateAdminOutletInput> = z.object({
    name: z.string().trim().min(2),
    address: z.string().trim().min(5),
    city: z.string().trim().min(2),
    province: z.string().trim().min(2),
    latitude: z.coerce.number().finite(),
    longitude: z.coerce.number().finite(),
    maxServiceRadiusKm: z.coerce.number().positive().optional(),
  })

  static readonly UPDATE: ZodType<UpdateAdminOutletInput> = z
    .object({
      name: z.string().trim().min(2).optional(),
      address: z.string().trim().min(5).optional(),
      city: z.string().trim().min(2).optional(),
      province: z.string().trim().min(2).optional(),
      latitude: z.coerce.number().finite().optional(),
      longitude: z.coerce.number().finite().optional(),
      maxServiceRadiusKm: z.coerce.number().positive().optional(),
      isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' })
}
