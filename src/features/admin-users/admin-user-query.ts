import { prisma } from '@/application/database'
import { StaffRole } from '@/generated/prisma/enums'
import type { Prisma } from '@/generated/prisma/client'
import type { AdminUserResponse } from './admin-user-model'
import { toAdminUserResponse } from './admin-user-model'

const VALID_USER_SORT = ['createdAt', 'name', 'email'] as const
type UserSortField = typeof VALID_USER_SORT[number]

// Scopes user query by outlet and role. OUTLET_ADMIN sees only users from their outlet.
export const buildUsersWhere = (
  outletId: string | null | undefined,
  role?: string,
): Prisma.StaffWhereInput => {
  const where: Prisma.StaffWhereInput = {}

  // Admin user management only returns users that are actually staff accounts.
  if (outletId) where.outletId = outletId
  if (role) where.role = role as StaffRole

  return where
}

export const fetchUsers = async (
  where: Prisma.StaffWhereInput,
  page: number,
  limit: number,
  sortBy = 'createdAt',
  sortOrder = 'desc',
) => {
  const skip = (page - 1) * limit
  // Allowlist sortBy to prevent probing internal field names via Prisma error messages.
  const validSortBy: UserSortField = VALID_USER_SORT.includes(sortBy as UserSortField)
    ? (sortBy as UserSortField)
    : 'createdAt'
  const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc'
  const orderBy: Prisma.StaffOrderByWithRelationInput = validSortBy === 'createdAt'
    ? { user: { createdAt: validSortOrder } }
    : { user: { [validSortBy]: validSortOrder } }

  const users = await prisma.staff.findMany({
    where,
    include: {
      outlet: {
        select: {
          id: true,
          name: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          createdAt: true,
        },
      },
    },
    orderBy,
    skip,
    take: limit,
  })
  const total = await prisma.staff.count({ where })

  const data: AdminUserResponse[] = users.map((staff) =>
    toAdminUserResponse({
      ...staff.user,
      staff: {
        id: staff.id,
        role: staff.role,
        outletId: staff.outletId,
        outlet: staff.outlet,
        isActive: staff.isActive,
        workerType: staff.workerType,
      },
    }),
  )

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}
