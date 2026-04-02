import { NextFunction, Request, Response } from 'express';
import { Validation } from '@/validations/validation';
import type { UserRequest } from '@/types/user-request';
import { PaymentValidation } from '@/validations/payment-validation';
import { PaymentService } from './payment-service';

export class PaymentController {
  static async initiate(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const orderId = Validation.validate(PaymentValidation.ID_PARAM, req.params.id);
      const data = await PaymentService.initiatePayment(req.user!.id, orderId);
      res.status(201).json({ status: 'success', message: 'Payment initiated', data });
    } catch (error) {
      next(error);
    }
  }

  static async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = Validation.validate(PaymentValidation.WEBHOOK, req.body);
      await PaymentService.handleWebhook(payload);
      res.status(200).json({ status: 'success', message: 'Webhook processed', data: null });
    } catch (error) {
      next(error);
    }
  }
}
