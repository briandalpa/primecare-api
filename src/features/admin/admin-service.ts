import { prisma } from '@/application/database'
import { ResponseError } from '@/error/response-error'
import { sendEmail } from '@/utils/mailer'
import { v4 as uuid } from 'uuid'
import {
  CreateAdminUserInput,
  UpdateAdminUserInput,
  toAdminUserResponse
} from './admin-model'

// ================= USERS =================

const fetchAllUsers = async () => {
  const users = await prisma.user.findMany({
    include: { staff: true },
    orderBy: { createdAt: 'desc' }
  })

  return users.map(toAdminUserResponse)
}

const fetchOutletUsers = async (outletId: string) => {
  const users = await prisma.user.findMany({
    where: { staff: { outletId } },
    include: { staff: true },
    orderBy: { createdAt: 'desc' }
  })

  return users.map(toAdminUserResponse)
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
      isActive: true
    }
  })

  return user
}

const createInviteToken = async (email: string) => {

  const token = uuid()

  await prisma.verification.create({
    data: {
      id: uuid(),
      identifier: email,
      value: token,
      expiresAt: new Date(Date.now() + 3600 * 1000)
    }
  })

  return token
}

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

// ================= ORDER PRICE (PCS-124) =================

const calculateOrderPrice = (
  totalWeightKg: number,
  pricePerKg: number
) => {
  return totalWeightKg * pricePerKg
}

// ================= SERVICE =================

export class AdminService {

  // USERS

  static async getAdminUsers(staff: any) {
    if (staff.role === 'SUPER_ADMIN') {
      return fetchAllUsers()
    }

    if (staff.role === 'OUTLET_ADMIN' && staff.outletId) {
      return fetchOutletUsers(staff.outletId)
    }

    throw new ResponseError(403, 'Forbidden')
  }

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

    return prisma.staff.update({
      where: { userId },
      data: {
        role: data.role ?? staff.role,
        outletId: data.outletId ?? staff.outletId,
        isActive: data.isActive ?? staff.isActive
      }
    })
  }

  static async deleteAdminUser(userId: string) {

    const staff = await prisma.staff.findUnique({
      where: { userId }
    })

    if (!staff) {
      throw new ResponseError(404, 'User staff not found')
    }

    await prisma.staff.delete({
      where: { userId }
    })

    await prisma.user.delete({
      where: { id: userId }
    })

    return {
      message: 'User deleted successfully'
    }
  }

  // ================= PCS-118 =================

  static async getAdminOrders(
    staff: any,
    page: number,
    limit: number
  ) {

    const skip = (page - 1) * limit

    const where: any = {}

    if (staff.role === 'OUTLET_ADMIN') {
      where.outletId = staff.outletId
    }

    const orders = await prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        outlet: true,
        pickupRequest: true
      }
    })

    const total = await prisma.order.count({ where })

    return {
      data: orders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  // ================= PCS-119 =================

  static async getAdminOrderDetail(staff: any, orderId: string) {

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        pickupRequest: {
          include: {
            customerUser: true
          }
        },
        outlet: true,
        items: {
          include: {
            laundryItem: true
          }
        }
      }
    })

    if (!order) {
      throw new ResponseError(404, 'Order not found')
    }

    if (staff.role === 'OUTLET_ADMIN' && staff.outletId !== order.outletId) {
      throw new ResponseError(403, 'Forbidden')
    }

    return order
  }

  // ================= PCS-122 =================

  static async getAdminPickupRequests(staff: any) {

    const where: any = {
      status: 'PICKED_UP',
      order: null
    }

    if (staff.role === 'OUTLET_ADMIN') {
      where.outletId = staff.outletId
    }

    const pickups = await prisma.pickupRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customerUser: true,
        outlet: true,
        address: true
      }
    })

    return pickups
  }

  // ================= PCS-123 =================

  static async createAdminOrder(
    staff: any,
    data: {
      pickupRequestId: string
      pricePerKg: number
      totalWeightKg: number
    }
  ) {

    const pickupRequest = await prisma.pickupRequest.findUnique({
      where: { id: data.pickupRequestId }
    })

    if (!pickupRequest) {
      throw new ResponseError(404, 'Pickup request not found')
    }

    const totalPrice = calculateOrderPrice(
      data.totalWeightKg,
      data.pricePerKg
    )

    const order = await prisma.order.create({
      data: {
        pickupRequestId: pickupRequest.id,
        outletId: pickupRequest.outletId,
        staffId: staff.id,
        pricePerKg: data.pricePerKg,
        totalWeightKg: data.totalWeightKg,
        totalPrice
      }
    })

    return order
  }
}