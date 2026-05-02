import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import MidtransClient from 'midtrans-client';
import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import type { Prisma } from '@/generated/prisma/client';
import type { MidtransWebhookPayload } from './payment-model';

let _snap: InstanceType<typeof MidtransClient.Snap> | null = null;
let _core: InstanceType<typeof MidtransClient.CoreApi> | null = null;

export const getMidtransConfig = () => {
  if (!process.env.MIDTRANS_SERVER_KEY)
    throw new ResponseError(500, 'Payment gateway misconfigured');
  return {
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY ?? '',
  };
};

export const getSnap = () => {
  if (!_snap) _snap = new MidtransClient.Snap(getMidtransConfig());
  return _snap;
};

export const getCoreApi = () => {
  if (!_core) _core = new MidtransClient.CoreApi(getMidtransConfig());
  return _core;
};

export const verifySignature = (payload: MidtransWebhookPayload): boolean => {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) throw new ResponseError(500, 'Payment gateway misconfigured');
  const raw =
    payload.order_id + payload.status_code + payload.gross_amount + serverKey;
  const hash = crypto.createHash('sha512').update(raw).digest('hex');
  return hash === payload.signature_key;
};

export const fetchOrderForPayment = (orderId: string) =>
  prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payment: true,
      pickupRequest: { select: { customerId: true } },
    },
  });

export const fetchPaymentForWebhook = (paymentId: string) =>
  prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });

export async function upsertPaymentRecord(tx: Prisma.TransactionClient, paymentId: string, orderId: string, token: string, totalPrice: number, hasOldPayment: boolean) {
  if (hasOldPayment) await tx.payment.delete({ where: { orderId } }); // Midtrans rejects reused order_id
  return tx.payment.create({ data: { id: paymentId, orderId, amount: totalPrice, gateway: 'midtrans', gatewayTxId: token, status: 'PENDING' } });
}

export const persistNewPayment = async (orderId: string, hasOldPayment: boolean, totalPrice: number) => {
  const paymentId = uuidv4();
  const { token } = await getSnap().createTransaction({ transaction_details: { order_id: paymentId, gross_amount: totalPrice } });
  const payment = await prisma.$transaction((tx) => upsertPaymentRecord(tx, paymentId, orderId, token, totalPrice, hasOldPayment));
  return { payment, snapToken: token };
};

export const processFailure = (paymentId: string, status: 'EXPIRED' | 'FAILED') =>
  prisma.payment.update({ where: { id: paymentId }, data: { status } });

export async function runSettlementTx(tx: Prisma.TransactionClient, paymentId: string, orderId: string, isWaitingForPayment: boolean) {
  await tx.payment.update({ where: { id: paymentId }, data: { status: 'PAID', paidAt: new Date() } });
  await tx.order.update({ where: { id: orderId }, data: { paymentStatus: 'PAID', ...(isWaitingForPayment && { status: 'LAUNDRY_READY_FOR_DELIVERY' }) } });
  if (isWaitingForPayment) await tx.delivery.create({ data: { orderId, status: 'PENDING' } });
}

export const processSettlement = (paymentId: string, orderId: string, orderStatus: string) => {
  const isWaitingForPayment = orderStatus === 'WAITING_FOR_PAYMENT';
  return prisma.$transaction((tx) => runSettlementTx(tx, paymentId, orderId, isWaitingForPayment));
};

export async function dispatchWebhookStatus(payload: MidtransWebhookPayload, paymentId: string, orderId: string, orderStatus: string) {
  const { transaction_status, fraud_status } = payload;
  if (transaction_status === 'settlement' && fraud_status !== 'deny')
    return void (await processSettlement(paymentId, orderId, orderStatus));
  if (transaction_status === 'expire') await processFailure(paymentId, 'EXPIRED');
  else if (transaction_status === 'cancel' || transaction_status === 'deny') await processFailure(paymentId, 'FAILED');
}
