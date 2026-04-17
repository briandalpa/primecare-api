import { NextFunction, Response } from 'express';
import { Validation } from '@/validations/validation';
import { WorkerOrderValidation } from '@/validations/worker-order-validation';
import { UserRequest } from '@/types/user-request';
import { WorkerOrderService } from './worker-order-service';

export class WorkerOrderController {
  static async getOrders(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const query = Validation.validate(WorkerOrderValidation.LIST, req.query);
      const result = await WorkerOrderService.getWorkerOrders(req.staff!, query);

      res.status(200).json({
        status: 'success',
        message: 'Worker orders retrieved',
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getOrderDetail(
    req: UserRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const orderId = Validation.validate(
        WorkerOrderValidation.ID_PARAM,
        req.params.id,
      );
      const result = await WorkerOrderService.getWorkerOrderDetail(
        req.staff!,
        orderId,
      );

      res.status(200).json({
        status: 'success',
        message: 'Worker order retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async processOrder(
    req: UserRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const orderId = Validation.validate(
        WorkerOrderValidation.ID_PARAM,
        req.params.id,
      );
      const request = Validation.validate(
        WorkerOrderValidation.PROCESS,
        req.body,
      );
      const result = await WorkerOrderService.processWorkerOrder(
        req.staff!,
        orderId,
        request,
      );

      res.status(200).json({
        status: 'success',
        message: 'Worker order processed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
