export const makeDelivery = (overrides: object = {}) => ({
  id: '660e8400-e29b-41d4-a716-446655440010',
  orderId: '660e8400-e29b-41d4-a716-446655440011',
  driverId: null,
  status: 'PENDING',
  deliveredAt: null,
  createdAt: new Date(),
  ...overrides,
});

export const makeOrder = (overrides: object = {}) => ({
  id: '660e8400-e29b-41d4-a716-446655440011',
  outletId: '550e8400-e29b-41d4-a716-446655440002',
  pickupRequestId: '550e8400-e29b-41d4-a716-446655440004',
  paymentStatus: 'PAID',
  status: 'LAUNDRY_READY_FOR_DELIVERY',
  totalWeightKg: 3.5,
  pricePerKg: 15000,
  totalPrice: 52500,
  deliveryDistanceKm: 5.0,
  deliveryFee: 10000,
  staffId: '550e8400-e29b-41d4-a716-446655440001',
  confirmedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const makePickupRequestForDelivery = (overrides: object = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440004',
  customerId: '550e8400-e29b-41d4-a716-446655440000',
  addressId: '550e8400-e29b-41d4-a716-446655440003',
  outletId: '550e8400-e29b-41d4-a716-446655440002',
  driverId: null,
  scheduledAt: new Date('2026-04-01T09:00:00Z'),
  status: 'PICKED_UP',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const makeDeliveryAddress = (overrides: object = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440003',
  userId: '550e8400-e29b-41d4-a716-446655440000',
  label: 'Home',
  street: 'Jl. Sudirman No. 1',
  city: 'Jakarta',
  province: 'DKI Jakarta',
  latitude: -6.2088,
  longitude: 106.8456,
  isPrimary: true,
  createdAt: new Date(),
  ...overrides,
});

export const makeCustomerUser = (overrides: object = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+628123456789',
  emailVerified: true,
  image: null,
  avatarUrl: null,
  role: 'CUSTOMER',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
