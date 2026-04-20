import { NextFunction, Response } from 'express';
import { UserRequest } from '@/types/user-request';
import { Validation } from '@/validations/validation';
import { OrderValidation } from '@/validations/order-validation';
import { OrderService } from './order-service';

export class OrderController {

  static async listOrders(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const query = Validation.validate(OrderValidation.LIST_QUERY, req.query);
      const result = await OrderService.listOrders(req.user!.id, query);
      res.status(200).json({
        status:  'success',
        message: 'Orders retrieved',
        data:    result.data,
        meta:    result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getOrderDetail(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const { id: orderId } = Validation.validate(OrderValidation.ID_PARAM, req.params);
      const result = await OrderService.getOrderDetail(req.user!.id, orderId);
      res.status(200).json({
        status:  'success',
        message: 'Order retrieved',
        data:    result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async confirmReceipt(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const { id } = Validation.validate(OrderValidation.ID_PARAM, req.params);
      const result = await OrderService.confirmReceipt(req.user!.id, id);
      res.status(200).json({
        status:  'success',
        message: 'Order confirmed as received',
        data:    { id: result.id, status: result.status, confirmedAt: result.confirmedAt },
      });
    } catch (error) {
      next(error);
    }
  }
}
