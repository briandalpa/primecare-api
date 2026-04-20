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

export const toInitiatePaymentResponse = (
  payment: { id: string; orderId: string; amount: number },
  snapToken: string,
): InitiatePaymentResponse => {
  const base =
    process.env.MIDTRANS_IS_PRODUCTION === 'true'
      ? 'https://app.midtrans.com'
      : 'https://app.sandbox.midtrans.com';
  return {
    paymentId:   payment.id,
    orderId:     payment.orderId,
    amount:      payment.amount,
    snapToken,
    redirectUrl: `${base}/snap/v2/vtweb/${snapToken}`,
  };
};
