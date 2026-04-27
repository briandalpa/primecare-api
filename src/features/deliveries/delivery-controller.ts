import { Response } from 'express';
import { Validation } from '@/validations/validation';
import { ResponseError } from '@/error/response-error';
import { DeliveryValidation } from '@/validations/delivery-validation';
import { DeliveryService } from './delivery-service';
import type { UserRequest } from '@/types/user-request';

export class DeliveryController {
  static async list(req: UserRequest, res: Response) {
    if (!req.staff!.outletId) throw new ResponseError(409, 'Driver is not assigned to any outlet');

    const query = Validation.validate(DeliveryValidation.LIST, req.query);
    const response = await DeliveryService.listDeliveries(req.staff!.outletId, query);
    res.json({
      status: 'success',
      message: 'Deliveries retrieved',
      data: response.data,
      meta: response.meta,
    });
  }

  static async accept(req: UserRequest, res: Response) {
    if (!req.staff!.outletId) throw new ResponseError(409, 'Driver is not assigned to any outlet');

    const deliveryId = Validation.validate(DeliveryValidation.ID_PARAM, req.params.id);
    const response = await DeliveryService.acceptDelivery(req.staff!.id, deliveryId, req.staff!.outletId);
    res.json({
      status: 'success',
      message: 'Delivery accepted',
      data: response,
    });
  }

  static async getOrderSummary(req: UserRequest, res: Response) {
    const deliveryId = Validation.validate(DeliveryValidation.ID_PARAM, req.params.id);
    const response = await DeliveryService.getOrderSummary(req.staff!.id, deliveryId);
    res.json({ status: 'success', message: 'Order summary retrieved', data: response });
  }

  static async complete(req: UserRequest, res: Response) {
    const deliveryId = Validation.validate(DeliveryValidation.ID_PARAM, req.params.id);
    const response = await DeliveryService.completeDelivery(req.staff!.id, deliveryId);
    res.json({
      status: 'success',
      message: 'Delivery completed. Customer notified.',
      data: response,
    });
  }

  static async listHistory(req: UserRequest, res: Response) {
    if (!req.staff!.outletId) throw new ResponseError(409, 'Driver is not assigned to any outlet');

    const query = Validation.validate(DeliveryValidation.HISTORY, req.query);
    const response = await DeliveryService.listDriverHistory(req.staff!.id, query);
    res.json({
      status: 'success',
      message: 'Delivery history retrieved',
      data: response.data,
      meta: response.meta,
    });
  }
}
