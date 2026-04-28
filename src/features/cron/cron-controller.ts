import { NextFunction, Request, Response } from 'express';
import { runAutoConfirm } from '@/jobs/auto-confirm.job';
import { runPaymentDeadlineJob } from '@/jobs/payment-deadline.job';
import { logger } from '@/application/logging';

const verifyCronSecret = (req: Request, res: Response): boolean => {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.authorization !== `Bearer ${expected}`) {
    res.status(401).json({ status: 'error', message: 'Unauthorized' });
    return false;
  }
  return true;
};

export const CronController = {
  autoConfirm: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!verifyCronSecret(req, res)) return;
      await runAutoConfirm();
      res.status(200).json({ status: 'success', message: 'Auto-confirm job completed' });
    } catch (error) {
      logger.error('Cron auto-confirm error', error);
      next(error);
    }
  },

  paymentDeadline: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!verifyCronSecret(req, res)) return;
      await runPaymentDeadlineJob();
      res.status(200).json({ status: 'success', message: 'Payment deadline job completed' });
    } catch (error) {
      logger.error('Cron payment-deadline error', error);
      next(error);
    }
  },
};
