import { z, ZodType } from 'zod';
import { MidtransWebhookPayload } from '@/features/payments/payment-model';

export class PaymentValidation {
  static readonly ID_PARAM: ZodType<string> = z.string().uuid();
  static readonly WEBHOOK: ZodType<MidtransWebhookPayload> = z.object({
    order_id:           z.string(),
    transaction_status: z.string(),
    fraud_status:       z.string().optional(),
    gross_amount:       z.string(),
    status_code:        z.string(),
    signature_key:      z.string(),
  });
}
