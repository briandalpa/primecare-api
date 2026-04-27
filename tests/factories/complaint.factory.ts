export const COMPLAINT_IDS = {
  complaintId: 'aabbccdd-0001-4000-8000-aabbccdd0001',
  orderId: 'aabbccdd-0002-4000-8000-aabbccdd0002',
  outletId: 'aabbccdd-0003-4000-8000-aabbccdd0003',
  customerId: 'aabbccdd-0004-4000-8000-aabbccdd0004',
};

export const makeComplaintOutlet = (overrides: object = {}) => ({
  id: COMPLAINT_IDS.outletId,
  name: 'PrimeCare Kemang',
  ...overrides,
});

export const makeComplaintOrder = (overrides: object = {}) => ({
  id: COMPLAINT_IDS.orderId,
  outletId: COMPLAINT_IDS.outletId,
  status: 'LAUNDRY_DELIVERED_TO_CUSTOMER',
  paymentStatus: 'PAID',
  totalWeightKg: 2.0,
  pricePerKg: 10000,
  totalPrice: 30000,
  deliveryDistanceKm: 3.0,
  deliveryFee: 5000,
  staffId: 'aabbccdd-0005-4000-8000-aabbccdd0005',
  confirmedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  outlet: makeComplaintOutlet(),
  ...overrides,
});

export const makeComplaintCustomer = (overrides: object = {}) => ({
  id: COMPLAINT_IDS.customerId,
  name: 'Budi Santoso',
  email: 'budi@example.com',
  phone: '081234567890',
  emailVerified: true,
  image: null,
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const makeComplaint = (overrides: object = {}) => ({
  id: COMPLAINT_IDS.complaintId,
  orderId: COMPLAINT_IDS.orderId,
  customerId: COMPLAINT_IDS.customerId,
  description: 'My laundry was damaged',
  status: 'OPEN',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
