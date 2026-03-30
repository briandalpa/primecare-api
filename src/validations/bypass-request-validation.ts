import { z, ZodType } from "zod";
import {
  CreateBypassRequestInput,
} from "@/features/bypass-requests/bypass-request-model";

export class BypassRequestValidation {
  static readonly CREATE: ZodType<CreateBypassRequestInput> = z.object({
    stationRecordId: z.string().min(1),
    mismatchDetails: z.string().min(1),
  });

  static readonly APPROVE = z.object({
    password: z.string().min(1),
    problemDescription: z.string().min(1),
  });

  static readonly REJECT = z.object({
    password: z.string().min(1),
  });
}