import type { User } from '@/generated/prisma/client';

export type RegisterInput = { name: string; email: string };
export type SetPasswordInput = { token: string; password: string };
export type ResendVerificationInput = { email: string };

// Minimal response returned after registration; does not include profile or staff data.
export type CustomerRegistrationResponse = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
};

// Full profile response for GET /users/me; includes staff details when the user is a staff member.
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
  } | null; // null when the user has no Staff record, meaning they are a CUSTOMER.
};

export function toUserResponse(user: User): CustomerRegistrationResponse {
  return {
    id: user.id,
    name: user.name ?? '',
    email: user.email,
    emailVerified: user.emailVerified,
  };
}
