import { z, ZodType } from 'zod';
import type {
  RegisterInput,
  ResendVerificationInput,
  SetPasswordInput,
} from '@/features/users/user-model';

export class UserValidation {
  static readonly REGISTER: ZodType<RegisterInput> = z.object({
    name: z.string().min(2),
    email: z.email(),
  });

  static readonly SET_PASSWORD: ZodType<SetPasswordInput> = z.object({
    token: z.string().min(1),
    password: z.string().min(8),
  });

  static readonly RESEND_VERIFICATION: ZodType<ResendVerificationInput> =
    z.object({
      email: z.email(),
    });
}
