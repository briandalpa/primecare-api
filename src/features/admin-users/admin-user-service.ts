import { prisma } from '@/application/database'
import { ResponseError } from '@/error/response-error'
import { sendEmail } from '@/utils/mailer'
import { createHash } from 'crypto'
import { v4 as uuid } from 'uuid'
import {
  CreateAdminUserInput,
  GetAdminUsersQuery,
  UpdateAdminUserInput,
  toAdminUserResponse
} from './admin-user-model'

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const VALID_USER_SORT = ['createdAt', 'name', 'email'] as const;
type UserSortField = typeof VALID_USER_SORT[number];

// Scopes user query by outlet and role. OUTLET_ADMIN sees only users from their outlet.
const buildUsersWhere = (outletId: string | null | undefined, role?: string) => {
  const where: Record<string, unknown> = {}
  // Outlet filter applies when a specific outlet is passed (from OUTLET_ADMIN restriction).
  if (outletId) where.staff = { outletId }
  // Role filter layers on top of outlet filter using object spread.
  if (role) where.staff = { ...(where.staff as object ?? {}), role }
  return where
}

const fetchUsers = async (where: object, page: number, limit: number, sortBy = 'createdAt', sortOrder = 'desc') => {
  const skip = (page - 1) * limit
  // Allowlist sortBy to prevent probing internal field names via Prisma error messages.
  const validSortBy: UserSortField = VALID_USER_SORT.includes(sortBy as UserSortField)
    ? (sortBy as UserSortField)
    : 'createdAt'
  const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc'
  const users = await prisma.user.findMany({
    where,
    include: { staff: true },
    orderBy: { [validSortBy]: validSortOrder },
    skip,
    take: limit,
  })
  const total = await prisma.user.count({ where })
  return {
    data: users.map(toAdminUserResponse),
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

const createInviteToken = async (email: string) => {

  // Clear any existing tokens to prevent stale invite links after re-invitation.
  await prisma.verification.deleteMany({ where: { identifier: email } })

  const token = uuid()

  // Store hash in DB; return raw token for email. DB compromise cannot yield usable tokens.
  await prisma.verification.create({
    data: {
      id: uuid(),
      identifier: email,
      value: hashToken(token),
      expiresAt: new Date(Date.now() + 3600 * 1000)
    }
  })

  return token
}

// Non-blocking: email delivery failure should not prevent staff account creation.
const sendInviteEmail = (email: string, token: string) => {

  const link = `${process.env.FRONTEND_URL}/set-password?token=${token}`

  void sendEmail({
    to: email,
    subject: 'Set your PrimeCare password',
    html: `
      <p>You have been invited to PrimeCare.</p>
      <p>Click the link below to set your password.</p>
      <p><a href="${link}">${link}</a></p>
    `
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

  // Creates staff account and sends password setup email.
  // User is created without password; they must use the token link to set one.
  static async createAdminUser(data: CreateAdminUserInput) {

    const user = await createUserAndStaff(data)

    const token = await createInviteToken(data.email)

    sendInviteEmail(data.email, token)

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: data.role
    }
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
