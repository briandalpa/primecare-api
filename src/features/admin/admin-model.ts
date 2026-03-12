export type CreateAdminUserInput = {
  name: string;
  email: string;
  role: 'OUTLET_ADMIN' | 'WORKER' | 'DRIVER'; // SUPER_ADMIN is excluded; it is bootstrapped via seed only.
  outletId?: string; // Required for WORKER and DRIVER; optional for OUTLET_ADMIN who may be assigned later.
};

export type UpdateAdminUserInput = {
  role?: 'OUTLET_ADMIN' | 'WORKER' | 'DRIVER';
  outletId?: string;
  isActive?: boolean;
};

export type AdminUserResponse = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  createdAt: Date;
};

export function toAdminUserResponse(user: {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  staff: { role: string } | null;
}): AdminUserResponse {
  return {
    id: user.id,
    name: user.name ?? '',
    email: user.email,
    emailVerified: user.emailVerified,
    role: user.staff?.role ?? 'CUSTOMER', // Fallback to CUSTOMER when no Staff record exists; should not occur in an admin context.

    createdAt: user.createdAt,
  };
}
