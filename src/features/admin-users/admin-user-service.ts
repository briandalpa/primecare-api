import { prisma } from '@/application/database'
import { ResponseError } from '@/error/response-error'
import { StaffRole } from '@/generated/prisma/enums'
import bcrypt from 'bcrypt'
import type { Prisma } from '@/generated/prisma/client'
import { v4 as uuid } from 'uuid'
import {
  CreateAdminUserInput,
  GetAdminUsersQuery,
  UpdateAdminUserInput,
  type AdminUserResponse,
  toAdminUserResponse
} from './admin-user-model'

const VALID_USER_SORT = ['createdAt', 'name', 'email'] as const;
type UserSortField = typeof VALID_USER_SORT[number];

// Scopes user query by outlet and role. OUTLET_ADMIN sees only users from their outlet.
const buildUsersWhere = (outletId: string | null | undefined, role?: string): Prisma.StaffWhereInput => {
  const where: Prisma.StaffWhereInput = {}

  // Admin user management only returns users that are actually staff accounts.
  if (outletId) where.outletId = outletId
  if (role) where.role = role as StaffRole

  return where
}

const fetchUsers = async (where: Prisma.StaffWhereInput, page: number, limit: number, sortBy = 'createdAt', sortOrder = 'desc') => {
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
        role: staff.role,
        outletId: staff.outletId,
        outlet: staff.outlet,
        isActive: staff.isActive,
        workerType: staff.workerType,
      },
    })
  )

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  }
}

const createUserAndStaff = async (data: CreateAdminUserInput) => {

  const existing = await prisma.user.findUnique({
    where: { email: data.email }
  })

  if (existing) {
    throw new ResponseError(409, 'Email already registered')
  }

  const user = await prisma.user.create({
    data: {
      id: uuid(),
      name: data.name,
      email: data.email,
      emailVerified: false
    }
  })

  await prisma.staff.create({
    data: {
      id: uuid(),
      userId: user.id,
      role: data.role,
      outletId: data.outletId ?? null,
      workerType: data.workerType ?? null,
      isActive: true
    }
  })

  return user
}

const createCredentialAccount = async (userId: string, password: string) => {
  const hash = await bcrypt.hash(password, 10)
  await prisma.account.create({
    data: {
      id: uuid(),
      accountId: userId,
      providerId: 'credential',
      userId,
      password: hash,
    }
  })
}

export class AdminUserService {

  // Enforces role hierarchy. Only SUPER_ADMIN and OUTLET_ADMIN can list users.
  static async getAdminUsers(staff: any, query: GetAdminUsersQuery) {
    if (!['SUPER_ADMIN', 'OUTLET_ADMIN'].includes(staff.role)) {
      throw new ResponseError(403, 'Forbidden')
    }
    // OUTLET_ADMIN scope: restrict to users from their outlet only.
    const outletId = staff.role === 'OUTLET_ADMIN' ? staff.outletId : null
    const where = buildUsersWhere(outletId, query.role)
    return fetchUsers(where, query.page, query.limit, query.sortBy, query.sortOrder)
  }

  // Creates staff account with a credential password so the employee can login immediately.
  static async createAdminUser(data: CreateAdminUserInput) {

    const user = await createUserAndStaff(data)
    await createCredentialAccount(user.id, data.password)
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true }
    })

    const staffRecord = await prisma.staff.findUnique({
      where: { userId: user.id },
      include: { outlet: { select: { id: true, name: true } } }
    })

    return toAdminUserResponse({
      ...user,
      emailVerified: true,
      staff: staffRecord
        ? { role: staffRecord.role, outletId: staffRecord.outletId, isActive: staffRecord.isActive, workerType: staffRecord.workerType, outlet: staffRecord.outlet }
        : null
    })
  }

  static async updateAdminUser(
    userId: string,
    data: UpdateAdminUserInput
  ) {

    const staff = await prisma.staff.findUnique({
      where: { userId }
    })

    if (!staff) {
      throw new ResponseError(404, 'User staff not found')
    }

    const updated = await prisma.staff.update({
      where: { userId },
      data: {
        role: data.role ?? staff.role,
        outletId: data.outletId ?? staff.outletId,
        isActive: data.isActive ?? staff.isActive,
        workerType: data.workerType ?? staff.workerType
      },
      include: { user: true }
    })
    return toAdminUserResponse({ ...updated.user, staff: updated })
  }

  static async deleteAdminUser(userId: string) {

    const staff = await prisma.staff.findUnique({
      where: { userId }
    })

    if (!staff) {
      throw new ResponseError(404, 'User staff not found')
    }

    // Atomic: if user deletion fails after staff deletion, neither operation persists.
    await prisma.$transaction([
      prisma.staff.delete({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } })
    ])

    return {
      message: 'User deleted successfully'
    }
  }
}
