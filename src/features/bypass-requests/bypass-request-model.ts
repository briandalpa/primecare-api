import { z } from 'zod';

export const approveBypassSchema = z.object({
  password: z.string().min(1),
  problemDescription: z.string().min(1),
});

export const rejectBypassSchema = z.object({
  password: z.string().min(1),
  problemDescription: z.string().min(1),
});