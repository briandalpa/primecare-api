import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const SetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});
export type SetPasswordInput = z.infer<typeof SetPasswordSchema>;

export const ResendVerificationSchema = z.object({
  email: z.email(),
});
export type ResendVerificationInput = z.infer<typeof ResendVerificationSchema>;
