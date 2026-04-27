export type MidtransWebhookPayload = {
  order_id: string;
  transaction_status: string;
  fraud_status?: string;
  gross_amount: string;
  status_code: string;
  signature_key: string;
};

export interface InitiatePaymentResponse {
  paymentId: string;
  orderId: string;
  amount: number;
  snapToken: string;
  redirectUrl: string;
}

const getMidtransBaseUrl = () =>
  process.env.MIDTRANS_IS_PRODUCTION === 'true'
    ? 'https://app.midtrans.com'
    : 'https://app.sandbox.midtrans.com';

export const toInitiatePaymentResponse = (
  payment: { id: string; orderId: string; amount: number },
  snapToken: string,
): InitiatePaymentResponse => ({
  paymentId: payment.id,
  orderId: payment.orderId,
  amount: payment.amount,
  snapToken,
  redirectUrl: `${getMidtransBaseUrl()}/snap/v2/vtweb/${snapToken}`,
});
