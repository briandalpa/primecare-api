export const makeAddress = (overrides: Record<string, unknown> = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440003',
  userId: '550e8400-e29b-41d4-a716-446655440000',
  label: 'Home',
  street: '123 Main St',
  city: 'Jakarta',
  province: 'DKI Jakarta',
  latitude: -6.2,
  longitude: 106.8,
  phone: '081234567890',
  isPrimary: true,
  createdAt: new Date(),
  ...overrides,
});

export const makeOutlet = (overrides: Record<string, unknown> = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440002',
  name: 'PrimeCare Kemang',
  address: 'Jl. Kemang Raya No. 1',
  city: 'Jakarta Selatan',
  province: 'DKI Jakarta',
  latitude: -6.2607,
  longitude: 106.8143,
  maxServiceRadiusKm: 10.0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const makePickupRequest = (overrides: object = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440004',
  customerId: '550e8400-e29b-41d4-a716-446655440000',
  addressId: '550e8400-e29b-41d4-a716-446655440003',
  outletId: '550e8400-e29b-41d4-a716-446655440002',
  driverId: null,
  scheduledAt: new Date('2026-04-01T09:00:00Z'),
  status: 'PENDING',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
