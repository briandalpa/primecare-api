import type { User } from '@/generated/prisma/client';

export type RegisterInput = { name: string; email: string };
export type SetPasswordInput = { token: string; password: string };
export type ResendVerificationInput = { email: string };

export type CustomerRegistrationResponse = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
};

export type UserProfileResponse = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  image: string | null;
  avatarUrl: string | null;
  phone: string | null;
  createdAt: Date;
  staff: {
    role: string;
    workerType: string | null;
    outletId: string | null;
    isActive: boolean;
  } | null;
};

export function toUserResponse(user: User): CustomerRegistrationResponse {
  return {
    id: user.id,
    name: user.name ?? '',
    email: user.email,
    emailVerified: user.emailVerified,
  };
}
