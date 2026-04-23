import type { Prisma } from '@/generated/prisma/client'
import type { CreateAdminOrderInput, GetAdminOrdersQuery } from './admin-order-model'

const VALID_ORDER_SORT = ['createdAt', 'totalPrice', 'totalWeightKg'] as const
type OrderSortField = typeof VALID_ORDER_SORT[number]

const slugifyLaundryItem = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export const calculateOrderTotal = (data: CreateAdminOrderInput) => {
  const manualTotal = (data.manualItems ?? []).reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  )
  return manualTotal
}

export const getOrderSort = (query: GetAdminOrdersQuery) => ({
  sortBy: VALID_ORDER_SORT.includes(query.sortBy as OrderSortField)
    ? (query.sortBy as OrderSortField)
    : 'createdAt',
  sortOrder: query.sortOrder === 'asc' ? 'asc' : 'desc',
})

export const buildOrdersWhere = (staff: any, query: GetAdminOrdersQuery) => {
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

export const createManualOrderItems = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  manualItems: NonNullable<CreateAdminOrderInput['manualItems']>,
) => {
  await Promise.all(manualItems.map(async (item) => {
    const laundryItem = await tx.laundryItem.upsert({
      where: { slug: slugifyLaundryItem(item.name) },
      update: { name: item.name.trim(), isActive: true },
      create: { name: item.name.trim(), slug: slugifyLaundryItem(item.name) },
    })
    return tx.orderItem.create({
      data: {
        orderId,
        laundryItemId: laundryItem.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.quantity * item.unitPrice,
        isManualPriced: true,
      },
    })
  }))
}
