import { z, ZodType } from 'zod';

export type CreatePickupRequestInput = {
  addressId: string;
  scheduledAt: string;
};

export type ListPickupRequestsQuery = {
  page: number;
  limit: number;
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

  static readonly ID_PARAM: ZodType<string> = z.string().uuid();
}
