import { z, ZodType } from 'zod';
import type {
  RegisterInput,
  ResendVerificationInput,
  SetPasswordInput,
} from '@/features/users/user-model';

export class UserValidation {
  static readonly REGISTER: ZodType<RegisterInput> = z.object({
    name: z.string().min(2),
    // Normalize to lowercase to prevent duplicate accounts differing only by case.
    email: z.email().transform((e) => e.toLowerCase()),
  });

  static readonly SET_PASSWORD: ZodType<SetPasswordInput> = z.object({
    token: z.string().min(1),
    // Enforce basic complexity: uppercase, lowercase, and digit required.
    password: z
      .string()
      .min(8)
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one digit'),
  });

  static readonly RESEND_VERIFICATION: ZodType<ResendVerificationInput> =
    z.object({
      email: z.email().transform((e) => e.toLowerCase()),
    });
}
