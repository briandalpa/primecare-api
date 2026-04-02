import crypto from 'crypto';

export const PAYMENT_FACTORY_IDS = {
  CUSTOMER: '550e8400-e29b-41d4-a716-446655440000',
  ORDER:    '550e8400-e29b-41d4-a716-446655440010',
  PAYMENT:  '550e8400-e29b-41d4-a716-446655440020',
};

export const makeOrder = (overrides: Record<string, unknown> = {}) => ({
  id:            PAYMENT_FACTORY_IDS.ORDER,
  totalPrice:    35000,
  paymentStatus: 'UNPAID',
  status:        'WAITING_FOR_PAYMENT',
  payment:       null,
  pickupRequest: { customerId: PAYMENT_FACTORY_IDS.CUSTOMER },
  ...overrides,
});

export const makePayment = (overrides: Record<string, unknown> = {}) => ({
  id:          PAYMENT_FACTORY_IDS.PAYMENT,
  orderId:     PAYMENT_FACTORY_IDS.ORDER,
  amount:      35000,
  gateway:     'midtrans',
  gatewayTxId: 'snap-token-abc',
  status:      'PENDING',
  paidAt:      null,
  ...overrides,
});

export const makeSignature = (
  orderId: string,
  statusCode: string,
  grossAmount: string,
  key: string,
) => crypto.createHash('sha512').update(orderId + statusCode + grossAmount + key).digest('hex');

// Does NOT include fraud_status — callers spread it in when needed.
// This mirrors Midtrans behavior: fraud_status is optional and absent on non-card payments.
export const makeWebhookPayload = (
  paymentId: string,
  status: string,
  serverKey: string,
  statusCode = '200',
) => ({
  order_id:           paymentId,
  transaction_status: status,
  gross_amount:       '35000.00',
  status_code:        statusCode,
  signature_key:      makeSignature(paymentId, statusCode, '35000.00', serverKey),
});
