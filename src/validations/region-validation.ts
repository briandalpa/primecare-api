import { z, ZodType } from 'zod';

type GetCitiesInput = { provinceId: number };
type GeocodeInput = { city: string; province: string };

export class RegionValidation {
  static readonly GET_CITIES: ZodType<GetCitiesInput> = z.object({
    provinceId: z.coerce.number().int().positive(),
  });

  static readonly GEOCODE: ZodType<GeocodeInput> = z.object({
    city: z.string().min(1),
    province: z.string().min(1),
  });
}
