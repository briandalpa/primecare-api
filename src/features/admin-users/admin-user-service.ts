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
import { buildUsersWhere, fetchUsers } from './admin-user-query'

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

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

  const link = `${process.env.FRONTEND_URL}/auth/set-password?token=${token}`

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

    const staffRecord = await prisma.staff.findUnique({
      where: { userId: user.id },
      include: { outlet: { select: { id: true, name: true } } }
    })

    return toAdminUserResponse({
      ...user,
      staff: staffRecord
        ? {
            id: staffRecord.id,
            role: staffRecord.role,
            outletId: staffRecord.outletId,
            isActive: staffRecord.isActive,
            workerType: staffRecord.workerType,
            outlet: staffRecord.outlet,
          }
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
