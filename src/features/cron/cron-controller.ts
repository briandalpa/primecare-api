import { NextFunction, Request, Response } from 'express';
import { runAutoConfirm } from '@/jobs/auto-confirm.job';
import { runPaymentDeadlineJob } from '@/jobs/payment-deadline.job';
import { logger } from '@/application/logging';
import { verifyCronSecret } from './cron-helper';

export class CronController {
  static async autoConfirm(req: Request, res: Response, next: NextFunction) {
    try {
      if (!verifyCronSecret(req, res)) return;
      await runAutoConfirm();
      res.status(200).json({ status: 'success', message: 'Auto-confirm job completed' });
    } catch (error) {
      logger.error('Cron auto-confirm error', error);
      next(error);
    }
  }

  static async paymentDeadline(req: Request, res: Response, next: NextFunction) {
    try {
      if (!verifyCronSecret(req, res)) return;
      await runPaymentDeadlineJob();
      res.status(200).json({ status: 'success', message: 'Payment deadline job completed' });
    } catch (error) {
      logger.error('Cron payment-deadline error', error);
      next(error);
    }
  }
}
