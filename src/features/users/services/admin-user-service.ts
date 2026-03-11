import { prisma } from '@/application/database'
import { ResponseError } from '@/error/response-error'
import { sendEmail } from '@/utils/mailer'
import { v4 as uuid } from 'uuid'

export class AdminUserService {

  static async getAdminUsers(userId: string) {
    const staff = await prisma.staff.findUnique({
      where: { userId },
    })

    if (!staff) {
      throw new ResponseError(403, 'Forbidden')
    }

    if (staff.role === 'SUPER_ADMIN') {
      const users = await prisma.user.findMany({
        include: { staff: true },
        orderBy: { createdAt: 'desc' },
      })

      return users.map((user) => ({
        id: user.id,
        name: user.name ?? '',
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.staff?.role ?? 'CUSTOMER',
        createdAt: user.createdAt,
      }))
    }

    if (staff.role === 'OUTLET_ADMIN') {
      const users = await prisma.user.findMany({
        where: {
          staff: {
            outletId: staff.outletId,
          },
        },
        include: { staff: true },
        orderBy: { createdAt: 'desc' },
      })

      return users.map((user) => ({
        id: user.id,
        name: user.name ?? '',
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.staff?.role ?? 'CUSTOMER',
        createdAt: user.createdAt,
      }))
    }

    throw new ResponseError(403, 'Forbidden')
  }

  static async createAdminUser(
    userId: string,
    data: {
      name: string
      email: string
      role: 'OUTLET_ADMIN' | 'WORKER' | 'DRIVER'
      outletId?: string
    }
  ) {
    const requester = await prisma.staff.findUnique({
      where: { userId },
    })

    if (!requester || requester.role !== 'SUPER_ADMIN') {
      throw new ResponseError(403, 'Forbidden')
    }

    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (existing) {
      throw new ResponseError(409, 'Email already registered')
    }

    const user = await prisma.user.create({
      data: {
        id: uuid(),
        name: data.name,
        email: data.email,
        emailVerified: false,
      },
    })

    await prisma.staff.create({
      data: {
        id: uuid(),
        userId: user.id,
        role: data.role,
        outletId: data.outletId ?? null,
        isActive: true,
      },
    })

    const token = uuid()

    await prisma.verification.create({
      data: {
        id: uuid(),
        identifier: data.email,
        value: token,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      },
    })

    const link = `${process.env.FRONTEND_URL}/set-password?token=${token}`

    void sendEmail({
      to: data.email,
      subject: 'Set your PrimeCare password',
      html: `<p>You have been invited to PrimeCare.</p>
             <p>Click the link below to set your password. This link expires in 1 hour.</p>
             <p><a href="${link}">${link}</a></p>`,
    })

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: data.role,
    }
  }

  static async updateAdminUser(
    requesterId: string,
    userId: string,
    data: {
      role?: 'OUTLET_ADMIN' | 'WORKER' | 'DRIVER'
      outletId?: string
      isActive?: boolean
    }
  ) {
    const requester = await prisma.staff.findUnique({
      where: { userId: requesterId },
    })

    if (!requester || requester.role !== 'SUPER_ADMIN') {
      throw new ResponseError(403, 'Forbidden')
    }

    const staff = await prisma.staff.findUnique({
      where: { userId },
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
      },
    })

    return updated
  }

  static async deleteAdminUser(requesterId: string, userId: string) {
    const requester = await prisma.staff.findUnique({
      where: { userId: requesterId },
    })

    if (!requester || requester.role !== 'SUPER_ADMIN') {
      throw new ResponseError(403, 'Forbidden')
    }

    const staff = await prisma.staff.findUnique({
      where: { userId },
    })

    if (!staff) {
      throw new ResponseError(404, 'User staff not found')
    }

    await prisma.staff.delete({
      where: { userId },
    })

    await prisma.user.delete({
      where: { id: userId },
    })

    return { message: 'User deleted successfully' }
  }

}