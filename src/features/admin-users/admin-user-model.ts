export type CreateAdminUserInput = {
  name: string;
  email: string;
  role: 'OUTLET_ADMIN' | 'WORKER' | 'DRIVER'; // SUPER_ADMIN is excluded; it is bootstrapped via seed only.
  outletId?: string; // Required for WORKER and DRIVER; optional for OUTLET_ADMIN who may be assigned later.
  workerType?: 'WASHING' | 'IRONING' | 'PACKING'; // Required when role is WORKER.
};

export type UpdateAdminUserInput = {
  role?: 'OUTLET_ADMIN' | 'WORKER' | 'DRIVER';
  outletId?: string;
  isActive?: boolean;
  workerType?: 'WASHING' | 'IRONING' | 'PACKING';
};

export type AdminUserResponse = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  outletId: string | null;
  outlet: { id: string; name: string } | null;
  isActive: boolean | null;
  workerType: string | null;
  createdAt: Date;
};

export type GetAdminUsersQuery = {
  page: number;
  limit: number;
  role?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export function toAdminUserResponse(user: {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  staff: {
    role: string;
    outletId: string | null;
    isActive: boolean;
    workerType: string | null;
    outlet?: { id: string; name: string } | null;
  } | null;
}): AdminUserResponse {
  return {
    id: user.id,
    name: user.name ?? '',
    email: user.email,
    emailVerified: user.emailVerified,
    role: user.staff?.role ?? 'CUSTOMER', // Fallback to CUSTOMER when no Staff record exists; should not occur in an admin context.
    outletId: user.staff?.outletId ?? null,
    outlet: user.staff?.outlet ?? null,
    isActive: user.staff?.isActive ?? null,
    workerType: user.staff?.workerType ?? null,
    createdAt: user.createdAt,
  };
}
