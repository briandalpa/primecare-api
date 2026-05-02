import { logger } from '@/application/logging';
import { ResponseError } from '@/error/response-error';
import {
  InitiatePaymentResponse,
  MidtransWebhookPayload,
  toInitiatePaymentResponse,
} from './payment-model';
import {
  getCoreApi,
  verifySignature,
  fetchOrderForPayment,
  fetchPaymentForWebhook,
  persistNewPayment,
  processFailure,
  processSettlement,
  dispatchWebhookStatus,
} from './payment-helper';

export class PaymentService {
  static async initiatePayment(customerId: string, orderId: string): Promise<InitiatePaymentResponse> {
    const order = await fetchOrderForPayment(orderId);
    if (!order) throw new ResponseError(404, 'Order not found');
    if (order.pickupRequest.customerId !== customerId) throw new ResponseError(403, 'You are not authorized to pay for this order');
    if (order.paymentStatus === 'PAID') throw new ResponseError(409, 'Order has already been paid');
    if (order.payment?.status === 'PENDING' && order.payment.gatewayTxId)
      return toInitiatePaymentResponse(order.payment, order.payment.gatewayTxId);
    const { payment, snapToken } = await persistNewPayment(orderId, !!order.payment, order.totalPrice);
    return toInitiatePaymentResponse(payment, snapToken);
  }

  static async verifyPayment(customerId: string, orderId: string): Promise<void> {
    const order = await fetchOrderForPayment(orderId);
    if (!order) throw new ResponseError(404, 'Order not found');
    if (order.pickupRequest.customerId !== customerId) throw new ResponseError(403, 'You are not authorized to verify this payment');
    if (order.paymentStatus === 'PAID') return;
    if (!order.payment) throw new ResponseError(404, 'No payment initiated for this order');
    const { transaction_status, fraud_status } = await getCoreApi().transaction.status(order.payment.id);
    if (transaction_status === 'settlement' && fraud_status !== 'deny') await processSettlement(order.payment.id, orderId, order.status);
    else if (transaction_status === 'expire') await processFailure(order.payment.id, 'EXPIRED');
    else if (transaction_status === 'cancel' || transaction_status === 'deny') await processFailure(order.payment.id, 'FAILED');
  }

  static async handleWebhook(payload: MidtransWebhookPayload): Promise<void> {
    if (!verifySignature(payload)) throw new ResponseError(400, 'Invalid signature');
    const payment = await fetchPaymentForWebhook(payload.order_id);
    if (!payment) { logger.warn(`Webhook received for unknown payment: ${payload.order_id}`); return; }
    if (payment.status === 'PAID') { logger.info(`Webhook duplicate for already-settled payment ${payment.id} — skipped`); return; }
    if (parseFloat(payload.gross_amount) !== payment.amount) { logger.warn(`Amount mismatch on webhook for payment ${payment.id}`); throw new ResponseError(400, 'Invalid webhook payload'); }
    await dispatchWebhookStatus(payload, payment.id, payment.orderId, payment.order.status);
  }
}
