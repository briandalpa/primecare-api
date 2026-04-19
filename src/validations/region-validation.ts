import { z, ZodType } from 'zod';

type GetCitiesInput = { provinceId: number };
type GeocodeInput = { city: string; province: string };
type ReverseGeocodeInput = { lat: number; lng: number };

export class RegionValidation {
  static readonly GET_CITIES: ZodType<GetCitiesInput> = z.object({
    provinceId: z.coerce.number().int().positive(),
  });

  static readonly GEOCODE: ZodType<GeocodeInput> = z.object({
    city: z.string().min(1),
    province: z.string().min(1),
  });

  static readonly REVERSE_GEOCODE: ZodType<ReverseGeocodeInput> = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
  });
}
