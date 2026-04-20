jest.mock('@/application/database', () => ({
  prisma: {
    outlet: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

import { prisma } from '@/application/database'
import { AdminOutletService } from '@/features/admin-outlets/admin-outlet-service'

const superAdmin = { role: 'SUPER_ADMIN' as const, outletId: null }
const outletAdmin = { role: 'OUTLET_ADMIN' as const, outletId: 'outlet-1' }

describe('AdminOutletService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.$transaction as jest.Mock).mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops))
  })

  it('returns paginated outlets for SUPER_ADMIN', async () => {
    ;(prisma.outlet.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'outlet-1',
        name: 'Outlet One',
        address: 'Jl. Mawar 1',
        city: 'Bandung',
        province: 'Jawa Barat',
        latitude: -6.9,
        longitude: 107.6,
        maxServiceRadiusKm: 10,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    ;(prisma.outlet.count as jest.Mock).mockResolvedValue(1)

    const result = await AdminOutletService.getAdminOutlets(superAdmin, { page: 1, limit: 10 })

    expect(result.data).toHaveLength(1)
    expect(result.meta.total).toBe(1)
  })

  it('scopes outlet list for OUTLET_ADMIN', async () => {
    ;(prisma.outlet.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.outlet.count as jest.Mock).mockResolvedValue(0)

    await AdminOutletService.getAdminOutlets(outletAdmin, { page: 1, limit: 10 })

    expect(prisma.outlet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'outlet-1' }) }),
    )
  })

  it('creates new outlet', async () => {
    ;(prisma.outlet.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.outlet.create as jest.Mock).mockResolvedValue({
      id: 'outlet-2',
      name: 'Outlet Two',
      address: 'Jl. Melati 2',
      city: 'Jakarta',
      province: 'DKI Jakarta',
      latitude: -6.2,
      longitude: 106.8,
      maxServiceRadiusKm: 10,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await AdminOutletService.createAdminOutlet({
      name: 'Outlet Two',
      address: 'Jl. Melati 2',
      city: 'Jakarta',
      province: 'DKI Jakarta',
      latitude: -6.2,
      longitude: 106.8,
    })

    expect(result.id).toBe('outlet-2')
  })

  it('throws 409 for duplicate outlet', async () => {
    ;(prisma.outlet.findFirst as jest.Mock).mockResolvedValue({ id: 'outlet-1' })

    await expect(
      AdminOutletService.createAdminOutlet({
        name: 'Outlet One',
        address: 'Jl. Mawar 1',
        city: 'Bandung',
        province: 'Jawa Barat',
        latitude: -6.9,
        longitude: 107.6,
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('returns outlet detail for scoped outlet admin', async () => {
    ;(prisma.outlet.findUnique as jest.Mock).mockResolvedValue({
      id: 'outlet-1',
      name: 'Outlet One',
      address: 'Jl. Mawar 1',
      city: 'Bandung',
      province: 'Jawa Barat',
      latitude: -6.9,
      longitude: 107.6,
      maxServiceRadiusKm: 10,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await AdminOutletService.getAdminOutletDetail(outletAdmin, 'outlet-1')

    expect(result.id).toBe('outlet-1')
  })

  it('deactivates outlet by setting isActive false', async () => {
    ;(prisma.outlet.findUnique as jest.Mock).mockResolvedValue({
      id: 'outlet-1',
      name: 'Outlet One',
    })
    ;(prisma.outlet.update as jest.Mock).mockResolvedValue({ id: 'outlet-1', isActive: false })

    const result = await AdminOutletService.deactivateAdminOutlet('outlet-1')

    expect(result.message).toBe('Outlet deactivated successfully')
    expect(prisma.outlet.update).toHaveBeenCalledWith({
      where: { id: 'outlet-1' },
      data: { isActive: false },
    })
  })
})
