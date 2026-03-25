import { z } from 'zod';

export class BypassRequestValidation {
  static readonly CREATE = z.object({
    stationRecordId: z.string().uuid(),
    mismatchDetails: z.string().min(1),
  });
}