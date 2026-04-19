import { prisma } from '@/application/database'
import { ResponseError } from '@/error/response-error'
import { StaffRole } from '@/generated/prisma/enums'
import {
  CreateAdminOutletInput,
  GetAdminOutletsQuery,
  UpdateAdminOutletInput,
  toAdminOutletResponse,
} from './admin-outlet-model'

const VALID_OUTLET_SORT = ['createdAt', 'name', 'city', 'province'] as const
type OutletSortField = (typeof VALID_OUTLET_SORT)[number]

const assertOutletAdminScope = (staff: { role: StaffRole; outletId?: string | null }) => {
  if (staff.role === StaffRole.OUTLET_ADMIN && !staff.outletId) {
    throw new ResponseError(422, 'Outlet admin outlet assignment is not configured')
  }
}

const buildOutletWhere = (
  staff: { role: StaffRole; outletId?: string | null },
  query: GetAdminOutletsQuery,
) => {
  const where: Record<string, unknown> = {}

  if (staff.role === StaffRole.OUTLET_ADMIN) where.id = staff.outletId
  if (query.isActive !== undefined) where.isActive = query.isActive
  if (!query.search) return where

  where.OR = [
    { name: { contains: query.search, mode: 'insensitive' } },
    { address: { contains: query.search, mode: 'insensitive' } },
    { city: { contains: query.search, mode: 'insensitive' } },
    { province: { contains: query.search, mode: 'insensitive' } },
  ]

  return where
}

const getValidOrderBy = (sortBy?: string, sortOrder?: 'asc' | 'desc') => {
  const field: OutletSortField = VALID_OUTLET_SORT.includes(sortBy as OutletSortField)
    ? (sortBy as OutletSortField)
    : 'createdAt'
  return { [field]: sortOrder === 'asc' ? 'asc' : 'desc' }
}

const findOutletOrThrow = async (id: string) => {
  const outlet = await prisma.outlet.findUnique({ where: { id } })
  if (!outlet) throw new ResponseError(404, 'Outlet not found')
  return outlet
}

const assertOutletAccess = (
  staff: { role: StaffRole; outletId?: string | null },
  outletId: string,
) => {
  if (staff.role === StaffRole.OUTLET_ADMIN && staff.outletId !== outletId) {
    throw new ResponseError(403, 'Forbidden')
  }
}

export class AdminOutletService {
  static async getAdminOutlets(
    staff: { role: StaffRole; outletId?: string | null },
    query: GetAdminOutletsQuery,
  ) {
    assertOutletAdminScope(staff)

    const where = buildOutletWhere(staff, query)
    const skip = (query.page - 1) * query.limit
    const orderBy = getValidOrderBy(query.sortBy, query.sortOrder)

    const [outlets, total] = await prisma.$transaction([
      prisma.outlet.findMany({ where, skip, take: query.limit, orderBy }),
      prisma.outlet.count({ where }),
    ])

    return {
      data: outlets.map(toAdminOutletResponse),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    }
  }

  static async createAdminOutlet(data: CreateAdminOutletInput) {
    const existing = await prisma.outlet.findFirst({
      where: { name: data.name, address: data.address, city: data.city, province: data.province },
    })
    if (existing) throw new ResponseError(409, 'Outlet already exists')

    const outlet = await prisma.outlet.create({
      data: { ...data, maxServiceRadiusKm: data.maxServiceRadiusKm ?? 10 },
    })

    return toAdminOutletResponse(outlet)
  }

  static async getAdminOutletDetail(
    staff: { role: StaffRole; outletId?: string | null },
    id: string,
  ) {
    assertOutletAdminScope(staff)
    const outlet = await findOutletOrThrow(id)
    assertOutletAccess(staff, outlet.id)
    return toAdminOutletResponse(outlet)
  }

  static async updateAdminOutlet(id: string, data: UpdateAdminOutletInput) {
    await findOutletOrThrow(id)
    const outlet = await prisma.outlet.update({ where: { id }, data })
    return toAdminOutletResponse(outlet)
  }

  static async deactivateAdminOutlet(id: string) {
    await findOutletOrThrow(id)
    await prisma.outlet.update({ where: { id }, data: { isActive: false } })
    return { message: 'Outlet deactivated successfully' }
  }
}
