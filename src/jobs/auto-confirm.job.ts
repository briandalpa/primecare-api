import cron from 'node-cron';
import { prisma } from '@/application/database';
import { logger } from '@/application/logging';

const AUTO_CONFIRM_MS = 48 * 60 * 60 * 1000;

export const runAutoConfirm = async () => {
  const threshold = new Date(Date.now() - AUTO_CONFIRM_MS);
  const result = await prisma.order.updateMany({
    where: { status: 'LAUNDRY_DELIVERED_TO_CUSTOMER', updatedAt: { lte: threshold } },
    data:  { status: 'COMPLETED', confirmedAt: new Date() },
  });
  if (result.count > 0) logger.info(`Auto-confirmed ${result.count} order(s)`);
};

export const startAutoConfirmJob = () => {
  cron.schedule('*/15 * * * *', async () => {
    logger.info('Running auto-confirm job');
    try {
      await runAutoConfirm();
    } catch (error) {
      logger.error('Auto-confirm job error', error);
    }
  });
  logger.info('Auto-confirm job scheduled (every 15 min)');
};
