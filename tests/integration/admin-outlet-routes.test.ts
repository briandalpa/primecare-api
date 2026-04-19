import type { Request, Response } from 'express'

jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((headers: Record<string, string | string[] | undefined>) => headers),
  toNodeHandler: jest.fn(() => (_req: Request, res: Response) => res.json({ ok: true })),
}))

jest.mock('@/application/database', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    staff: { findUnique: jest.fn() },
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

jest.mock('@/utils/auth', () => ({
  auth: {
    api: { getSession: jest.fn() },
  },
}))

import request from 'supertest'
import { app } from '@/application/app'
import { prisma } from '@/application/database'
import { auth } from '@/utils/auth'

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'

describe('Admin Outlet Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.$transaction as jest.Mock).mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops))
  })

  it('returns outlets for SUPER_ADMIN', async () => {
    ;(auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: { id: 'user-1' }, session: 'token' })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' })
    ;(prisma.staff.findUnique as jest.Mock).mockResolvedValue({ id: 'staff-1', role: 'SUPER_ADMIN', isActive: true })
    ;(prisma.outlet.findMany as jest.Mock).mockResolvedValue([
      {
        id: VALID_UUID,
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

    const response = await request(app).get('/api/v1/admin/outlets')

    expect(response.status).toBe(200)
    expect(Array.isArray(response.body.data)).toBe(true)
  })

  it('creates outlet for SUPER_ADMIN', async () => {
    ;(auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: { id: 'user-1' }, session: 'token' })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' })
    ;(prisma.staff.findUnique as jest.Mock).mockResolvedValue({ id: 'staff-1', role: 'SUPER_ADMIN', isActive: true })
    ;(prisma.outlet.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.outlet.create as jest.Mock).mockResolvedValue({
      id: VALID_UUID,
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

    const response = await request(app).post('/api/v1/admin/outlets').send({
      name: 'Outlet One',
      address: 'Jl. Mawar 1',
      city: 'Bandung',
      province: 'Jawa Barat',
      latitude: -6.9,
      longitude: 107.6,
    })

    expect(response.status).toBe(201)
  })

  it('returns 403 when OUTLET_ADMIN tries to create outlet', async () => {
    ;(auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: { id: 'user-1' }, session: 'token' })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' })
    ;(prisma.staff.findUnique as jest.Mock).mockResolvedValue({
      id: 'staff-1',
      role: 'OUTLET_ADMIN',
      isActive: true,
      outletId: VALID_UUID,
    })

    const response = await request(app).post('/api/v1/admin/outlets').send({
      name: 'Outlet One',
      address: 'Jl. Mawar 1',
      city: 'Bandung',
      province: 'Jawa Barat',
      latitude: -6.9,
      longitude: 107.6,
    })

    expect(response.status).toBe(403)
  })

  it('returns outlet detail for OUTLET_ADMIN own outlet', async () => {
    ;(auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: { id: 'user-1' }, session: 'token' })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' })
    ;(prisma.staff.findUnique as jest.Mock).mockResolvedValue({
      id: 'staff-1',
      role: 'OUTLET_ADMIN',
      isActive: true,
      outletId: VALID_UUID,
    })
    ;(prisma.outlet.findUnique as jest.Mock).mockResolvedValue({
      id: VALID_UUID,
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

    const response = await request(app).get(`/api/v1/admin/outlets/${VALID_UUID}`)

    expect(response.status).toBe(200)
  })

  it('soft-deactivates outlet for SUPER_ADMIN', async () => {
    ;(auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: { id: 'user-1' }, session: 'token' })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' })
    ;(prisma.staff.findUnique as jest.Mock).mockResolvedValue({ id: 'staff-1', role: 'SUPER_ADMIN', isActive: true })
    ;(prisma.outlet.findUnique as jest.Mock).mockResolvedValue({
      id: VALID_UUID,
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
    ;(prisma.outlet.update as jest.Mock).mockResolvedValue({ id: VALID_UUID, isActive: false })

    const response = await request(app).delete(`/api/v1/admin/outlets/${VALID_UUID}`)

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Outlet deactivated successfully')
  })
})
