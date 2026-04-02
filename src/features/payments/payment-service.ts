import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import MidtransClient from 'midtrans-client';
import { prisma } from '@/application/database';
import { logger } from '@/application/logging';
import { ResponseError } from '@/error/response-error';
import { InitiatePaymentResponse, MidtransWebhookPayload, toInitiatePaymentResponse } from './payment-model';

let _snap: InstanceType<typeof MidtransClient.Snap> | null = null;

const getSnap = () => {
  if (!_snap) {
    if (!process.env.MIDTRANS_SERVER_KEY) throw new ResponseError(500, 'Payment gateway misconfigured');
    _snap = new MidtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey:    process.env.MIDTRANS_SERVER_KEY,
      clientKey:    process.env.MIDTRANS_CLIENT_KEY ?? '',
    });
  }
  return _snap;
};

const verifySignature = (payload: MidtransWebhookPayload): boolean => {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) throw new ResponseError(500, 'Payment gateway misconfigured');
  const raw = payload.order_id + payload.status_code + payload.gross_amount + serverKey;
  const hash = crypto.createHash('sha512').update(raw).digest('hex');
  return hash === payload.signature_key;
};

const fetchOrderForPayment = (orderId: string) =>
  prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payment: true,
      pickupRequest: { select: { customerId: true } },
    },
  });

const persistNewPayment = async (orderId: string, hasOldPayment: boolean, totalPrice: number) => {
  const paymentId = uuidv4();
  const { token } = await getSnap().createTransaction({
    transaction_details: { order_id: paymentId, gross_amount: totalPrice },
  });
  const payment = await prisma.$transaction(async (tx) => {
    if (hasOldPayment) await tx.payment.delete({ where: { orderId } }); // Midtrans rejects reused order_id
    return tx.payment.create({
      data: { id: paymentId, orderId, amount: totalPrice, gateway: 'midtrans', gatewayTxId: token, status: 'PENDING' },
    });
  });
  return { payment, snapToken: token };
};

const processFailure = (paymentId: string, status: 'EXPIRED' | 'FAILED') =>
  prisma.payment.update({ where: { id: paymentId }, data: { status } });

const processSettlement = (paymentId: string, orderId: string, orderStatus: string) => {
  const isWaitingForPayment = orderStatus === 'WAITING_FOR_PAYMENT';
  return prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: paymentId }, data: { status: 'PAID', paidAt: new Date() } });
    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'PAID', ...(isWaitingForPayment && { status: 'LAUNDRY_READY_FOR_DELIVERY' }) },
    });
    if (isWaitingForPayment) await tx.delivery.create({ data: { orderId, status: 'PENDING' } });
  });
};

export class PaymentService {
  static async initiatePayment(customerId: string, orderId: string): Promise<InitiatePaymentResponse> {
    const order = await fetchOrderForPayment(orderId);
    if (!order) throw new ResponseError(404, 'Order not found');
    if (order.pickupRequest.customerId !== customerId)
      throw new ResponseError(403, 'You are not authorized to pay for this order');
    if (order.paymentStatus === 'PAID')
      throw new ResponseError(409, 'Order has already been paid');

    if (order.payment?.status === 'PENDING' && order.payment.gatewayTxId)
      return toInitiatePaymentResponse(order.payment, order.payment.gatewayTxId);

    const { payment, snapToken } = await persistNewPayment(orderId, !!order.payment, order.totalPrice);
    return toInitiatePaymentResponse(payment, snapToken);
  }

  static async handleWebhook(payload: MidtransWebhookPayload): Promise<void> {
    if (!verifySignature(payload)) throw new ResponseError(400, 'Invalid signature');
    const payment = await prisma.payment.findUnique({ where: { id: payload.order_id }, include: { order: true } });
    if (!payment) { logger.warn(`Webhook received for unknown payment: ${payload.order_id}`); return; }
    if (parseFloat(payload.gross_amount) !== payment.amount) {
      logger.warn(`Amount mismatch on webhook for payment ${payment.id}`);
      throw new ResponseError(400, 'Invalid webhook payload');
    }
    const { transaction_status, fraud_status } = payload;
    if (transaction_status === 'settlement' && fraud_status !== 'deny')
      return void await processSettlement(payment.id, payment.orderId, payment.order.status);
    if (transaction_status === 'expire') await processFailure(payment.id, 'EXPIRED');
    else if (transaction_status === 'cancel' || transaction_status === 'deny') await processFailure(payment.id, 'FAILED');
  }
}
