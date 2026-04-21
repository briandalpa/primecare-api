import { prisma } from '@/application/database';
import { logger } from '@/application/logging';
import { sendEmail } from '@/utils/mailer';

const paymentReminderHtml = (
  customerName: string | null,
  orderId: string,
  totalPrice: number,
  frontendUrl: string,
) => `
  <p>Hi ${customerName ?? 'there'},</p>
  <p>Your laundry order <strong>#${orderId}</strong> has finished packing and is waiting for payment.</p>
  <p>Total payment: <strong>Rp ${totalPrice.toLocaleString('id-ID')}</strong></p>
  <p><a href="${frontendUrl}/orders/${orderId}">Pay now</a> to continue delivery process.</p>
  <p>Thank you,<br/>PrimeCare Team</p>
`;

export async function sendPackingUnpaidPaymentReminder(orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        totalPrice: true,
        payment: { select: { id: true } },
        pickupRequest: {
          select: {
            customerUser: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!order || !order.pickupRequest?.customerUser?.email) return;

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

    await sendEmail({
      to: order.pickupRequest.customerUser.email,
      subject: 'Action required: complete your laundry payment',
      html: paymentReminderHtml(
        order.pickupRequest.customerUser.name,
        order.id,
        order.totalPrice,
        frontendUrl,
      ),
    });

    if (order.payment?.id) {
      await prisma.payment.update({
        where: { id: order.payment.id },
        data: { reminderSentAt: new Date() },
      });
    }

    logger.info(`Packing payment reminder sent for order ${order.id}`);
  } catch (error) {
    logger.warn(
      `Failed to send packing payment reminder for order ${orderId}`,
      error,
    );
  }
}
