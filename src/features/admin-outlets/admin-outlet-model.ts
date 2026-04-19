export type CreateAdminOutletInput = {
  name: string
  address: string
  city: string
  province: string
  latitude: number
  longitude: number
  maxServiceRadiusKm?: number
}

export type UpdateAdminOutletInput = Partial<CreateAdminOutletInput> & {
  isActive?: boolean
}

export type GetAdminOutletsQuery = {
  page: number
  limit: number
  search?: string
  isActive?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export type AdminOutletResponse = {
  id: string
  name: string
  address: string
  city: string
  province: string
  latitude: number
  longitude: number
  maxServiceRadiusKm: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

type OutletLike = AdminOutletResponse

export const toAdminOutletResponse = (outlet: OutletLike): AdminOutletResponse => ({
  id: outlet.id,
  name: outlet.name,
  address: outlet.address,
  city: outlet.city,
  province: outlet.province,
  latitude: outlet.latitude,
  longitude: outlet.longitude,
  maxServiceRadiusKm: outlet.maxServiceRadiusKm,
  isActive: outlet.isActive,
  createdAt: outlet.createdAt,
  updatedAt: outlet.updatedAt,
})
