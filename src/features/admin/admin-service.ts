import { prisma } from '@/application/database'
import { ResponseError } from '@/error/response-error'
import { sendEmail } from '@/utils/mailer'
import { v4 as uuid } from 'uuid'
import {
  CreateAdminOrderInput,
  CreateAdminUserInput,
  GetAdminOrdersQuery,
  GetAdminUsersQuery,
  UpdateAdminUserInput,
  toAdminUserResponse
} from './admin-model'

// ================= USERS =================

const buildUsersWhere = (outletId: string | null | undefined, role?: string) => {
  const where: Record<string, unknown> = {}
  if (outletId) where.staff = { outletId }
  if (role) where.staff = { ...(where.staff as object ?? {}), role }
  return where
}

const fetchUsers = async (where: object, page: number, limit: number, sortBy = 'createdAt', sortOrder = 'desc') => {
  const skip = (page - 1) * limit
  const users = await prisma.user.findMany({
    where,
    include: { staff: true },
    orderBy: { [sortBy]: sortOrder },
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

// ================= ORDERS =================

const buildOrdersWhere = (staff: any, query: GetAdminOrdersQuery) => {
  const where: Record<string, unknown> = {}
  if (staff.role === 'OUTLET_ADMIN') where.outletId = staff.outletId
  else if (query.outletId) where.outletId = query.outletId
  if (query.status) where.status = query.status
  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    }
  }
  return where
}

// ================= SERVICE =================

export class AdminService {

  // USERS — PCS-111, PCS-112, PCS-113, PCS-114

  static async getAdminUsers(staff: any, query: GetAdminUsersQuery) {
    if (!['SUPER_ADMIN', 'OUTLET_ADMIN'].includes(staff.role)) {
      throw new ResponseError(403, 'Forbidden')
    }
    const outletId = staff.role === 'OUTLET_ADMIN' ? staff.outletId : null
    const where = buildUsersWhere(outletId, query.role)
    return fetchUsers(where, query.page, query.limit, query.sortBy, query.sortOrder)
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
        isActive: data.isActive ?? staff.isActive,
        workerType: data.workerType ?? staff.workerType
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

  static async getAdminOrders(staff: any, query: GetAdminOrdersQuery) {

    const skip = (query.page - 1) * query.limit
    const where = buildOrdersWhere(staff, query)
    const sortBy = query.sortBy ?? 'createdAt'
    const sortOrder = query.sortOrder ?? 'desc'

    const orders = await prisma.order.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        outlet: true,
        pickupRequest: true
      }
    })

    const total = await prisma.order.count({ where })

    return {
      data: orders,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    }
  }

  // ================= PCS-119 =================

  static async getAdminOrderDetail(staff: any, orderId: string) {

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        pickupRequest: {
          include: { customerUser: true }
        },
        outlet: true,
        items: {
          include: { laundryItem: true }
        },
        stationRecords: {
          include: {
            staff: { include: { user: true } },
            stationItems: { include: { laundryItem: true } },
            bypassRequests: true
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

  static async getAdminPickupRequests(staff: any, page: number, limit: number) {

    const skip = (page - 1) * limit
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
      skip,
      take: limit,
      include: {
        customerUser: true,
        outlet: true,
        address: true
      }
    })

    const total = await prisma.pickupRequest.count({ where })

    return {
      data: pickups,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
    }
  }

  // ================= PCS-123 =================

  static async createAdminOrder(staff: any, data: CreateAdminOrderInput) {

    const pickupRequest = await prisma.pickupRequest.findUnique({
      where: { id: data.pickupRequestId },
      include: { order: true }
    })

    if (!pickupRequest) {
      throw new ResponseError(404, 'Pickup request not found')
    }

    if (pickupRequest.status !== 'PICKED_UP') {
      throw new ResponseError(409, 'Pickup has not been collected yet')
    }

    if (pickupRequest.order) {
      throw new ResponseError(409, 'Order already exists for this pickup request')
    }

    if (staff.role === 'OUTLET_ADMIN' && pickupRequest.outletId !== staff.outletId) {
      throw new ResponseError(403, 'Forbidden')
    }

    const totalPrice = calculateOrderPrice(data.totalWeightKg, data.pricePerKg)

    const orderId = uuid()

    const [order] = await prisma.$transaction([
      prisma.order.create({
        data: {
          id: orderId,
          pickupRequestId: pickupRequest.id,
          outletId: pickupRequest.outletId,
          staffId: staff.id,
          pricePerKg: data.pricePerKg,
          totalWeightKg: data.totalWeightKg,
          totalPrice
        }
      }),
      ...data.items.map((item) =>
        prisma.orderItem.create({
          data: {
            id: uuid(),
            orderId,
            laundryItemId: item.laundryItemId,
            quantity: item.quantity
          }
        })
      )
    ])

    return order
  }
}
