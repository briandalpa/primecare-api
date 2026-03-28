import { z } from "zod";

export class BypassRequestValidation {
  static CREATE = z.object({
    stationRecordId: z.string().uuid(),
    mismatchDetails: z.string().min(1),
  });
}