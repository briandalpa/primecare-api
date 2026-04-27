import { z, ZodType } from 'zod';
import type { CreateAddressInput, UpdateAddressInput } from '@/features/addresses/address-model';

const coordsSchema = {
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
};

export class AddressValidation {
  static readonly CREATE: ZodType<CreateAddressInput> = z.object({
    label: z.string().min(1).max(50),
    street: z.string().min(1).max(255),
    city: z.string().min(1).max(100),
    province: z.string().min(1).max(100),
    ...coordsSchema,
    phone: z.string().min(8).max(20),
  });

  static readonly UPDATE: ZodType<UpdateAddressInput> = z
    .object({
      label: z.string().min(1).max(50).optional(),
      street: z.string().min(1).max(255).optional(),
      city: z.string().min(1).max(100).optional(),
      province: z.string().min(1).max(100).optional(),
      latitude: coordsSchema.latitude.optional(),
      longitude: coordsSchema.longitude.optional(),
      phone: z.string().min(8).max(20).optional(),
    })
    .refine((d) => Object.values(d).some((v) => v !== undefined), {
      message: 'At least one field must be provided',
    })
    .refine((d) => (d.latitude == null) === (d.longitude == null), {
      message: 'latitude and longitude must be provided together',
    });
}
