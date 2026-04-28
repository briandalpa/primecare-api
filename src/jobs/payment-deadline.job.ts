import cron from 'node-cron';
import { prisma } from '@/application/database';
import { logger } from '@/application/logging';
import { sendEmail } from '@/utils/mailer';

const PACKING_THRESHOLD_MS = 30 * 60 * 1000;
const PAYMENT_REMINDER_MS = 2 * 60 * 60 * 1000;

const packingEmailHtml = (name: string | null, orderId: string): string => `
  <p>Hi ${name ?? 'there'},</p>
  <p>Your laundry order <strong>#${orderId}</strong> is currently being packed
  and will be ready soon.</p>
  <p>Please prepare your payment so delivery can be dispatched immediately after
  packing is complete.</p>
  <p>Thank you for choosing PrimeCare!</p>
`;

const reminderEmailHtml = (
  name: string | null,
  orderId: string,
  frontendUrl: string,
): string => `
  <p>Hi ${name ?? 'there'},</p>
  <p>Your laundry order <strong>#${orderId}</strong> is packed and waiting for
  payment before we can arrange delivery.</p>
  <p><a href="${frontendUrl}/orders/${orderId}">Complete payment now</a></p>
  <p>Please pay as soon as possible to avoid delays.</p>
  <p>Thank you,<br/>PrimeCare Team</p>
`;

const fetchPackingOrders = async (threshold: Date) =>
  prisma.order.findMany({
    where: {
      status: 'LAUNDRY_BEING_PACKED',
      updatedAt: { lte: threshold },
      payment: { reminderSentAt: null },
    },
    include: {
      payment: true,
      pickupRequest: {
        include: { customerUser: { select: { email: true, name: true } } },
      },
    },
  });

type PackingOrder = Awaited<ReturnType<typeof fetchPackingOrders>>[number];

const notifyPackingOrder = async (order: PackingOrder) => {
  const { email, name } = order.pickupRequest.customerUser;
  try {
    await sendEmail({
      to: email,
      subject: 'Your laundry is almost ready — payment coming up',
      html: packingEmailHtml(name, order.id),
    });
    if (order.payment)
      await prisma.payment.update({
        where: { id: order.payment.id },
        data: { reminderSentAt: new Date() },
      });
    logger.info(`Packing heads-up sent for order ${order.id} to ${email}`);
  } catch (err) {
    logger.warn(
      `Failed to send packing heads-up for order ${order.id} to ${email}`,
      err,
    );
  }
};

const sendPackingHeadsUp = async () => {
  const threshold = new Date(Date.now() - PACKING_THRESHOLD_MS);
  const orders = await fetchPackingOrders(threshold);
  for (const order of orders) await notifyPackingOrder(order);
};

const fetchReminderOrders = async (threshold: Date) =>
  prisma.order.findMany({
    where: {
      status: 'WAITING_FOR_PAYMENT',
      updatedAt: { lte: threshold },
      payment: { reminderSentAt: null },
    },
    include: {
      payment: { select: { id: true } },
      pickupRequest: {
        include: { customerUser: { select: { email: true, name: true } } },
      },
    },
  });

type ReminderOrder = Awaited<ReturnType<typeof fetchReminderOrders>>[number];

const notifyReminderOrder = async (order: ReminderOrder) => {
  const { email, name } = order.pickupRequest.customerUser;
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  try {
    await sendEmail({
      to: email,
      subject: 'Action required: complete your laundry payment',
      html: reminderEmailHtml(name, order.id, frontendUrl),
    });
    if (order.payment) {
      await prisma.payment.update({
        where: { id: order.payment.id },
        data: { reminderSentAt: new Date() },
      });
    }
    logger.info(`Payment reminder sent for order ${order.id} to ${email}`);
  } catch (err) {
    logger.warn(
      `Failed to send payment reminder for order ${order.id} to ${email}`,
      err,
    );
  }
};

const sendPaymentReminder = async () => {
  const threshold = new Date(Date.now() - PAYMENT_REMINDER_MS);
  const orders = await fetchReminderOrders(threshold);
  for (const order of orders) await notifyReminderOrder(order);
};

export const runPaymentDeadlineJob = async () => {
  await sendPackingHeadsUp();
  await sendPaymentReminder();
};

export const startPaymentDeadlineJob = () => {
  cron.schedule('*/30 * * * *', async () => {
    logger.info('Running payment deadline notification job');
    try {
      await sendPackingHeadsUp();
      await sendPaymentReminder();
    } catch (error) {
      logger.error('Payment deadline job error', error);
    }
  });
  logger.info('Payment deadline notification job scheduled (every 30 min)');
};
