import { Response, NextFunction } from 'express';
import { BypassRequestService } from './bypass-request-service';
import type { AdminContext } from './bypass-request-model';
import { Validation } from '@/validations/validation';
import { BypassRequestValidation } from '@/validations/bypass-request-validation';
import { UserRequest } from '@/types/user-request';
import type { StationType } from '@/generated/prisma/client';
import { ResponseError } from '@/error/response-error';

export class BypassRequestController {
  static async createWorker(
    req: UserRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const station = req.staff?.workerType;

      if (!station) {
        throw new ResponseError(
          422,
          'Worker station or outlet assignment is not configured',
        );
      }

      const orderId = Validation.validate(
        BypassRequestValidation.ID_PARAM,
        req.params.id,
      );
      const request = Validation.validate(
        BypassRequestValidation.CREATE,
        req.body,
      );

      const result = await BypassRequestService.create(
        req.staff!.id,
        orderId,
        station,
        request,
      );

      res.status(201).json({
        status: 'success',
        message: 'Bypass request submitted. Awaiting admin approval.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const station = Validation.validate(
        BypassRequestValidation.STATION_PARAM,
        req.params.station,
      ) as StationType;
      const orderId = Validation.validate(
        BypassRequestValidation.ID_PARAM,
        req.params.id,
      );
      const request = Validation.validate(
        BypassRequestValidation.CREATE,
        req.body,
      );

      const result = await BypassRequestService.create(
        req.staff!.id,
        orderId,
        station,
        request,
      );

      res.status(201).json({
        status: 'success',
        message: 'Bypass request submitted. Awaiting admin approval.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  private static adminFrom(req: UserRequest): AdminContext {
    return {
      staffId: req.staff!.id,
      userId: req.staff!.userId,
      role: req.staff!.role,
      outletId: req.staff!.outletId ?? undefined,
    };
  }

  static async getAll(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const query = Validation.validate(
        BypassRequestValidation.LIST,
        req.query,
      );

      const result = await BypassRequestService.getAll(
        req.staff!.role,
        req.staff!.outletId ?? undefined,
        query,
      );

      res.status(200).json({
        status: 'success',
        message: 'Bypass requests retrieved',
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  static async approve(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const bypassId = Validation.validate(
        BypassRequestValidation.ID_PARAM,
        req.params.id,
      );
      const { password, problemDescription } = Validation.validate(
        BypassRequestValidation.APPROVE,
        req.body,
      );
      const result = await BypassRequestService.approve(
        BypassRequestController.adminFrom(req),
        bypassId,
        password,
        problemDescription,
      );
      res.status(200).json({
        status: 'success',
        message: 'Bypass approved. Order advanced to next station.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async reject(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const bypassId = Validation.validate(
        BypassRequestValidation.ID_PARAM,
        req.params.id,
      );
      const { password } = Validation.validate(
        BypassRequestValidation.REJECT,
        req.body,
      );
      const result = await BypassRequestService.reject(
        BypassRequestController.adminFrom(req),
        bypassId,
        password,
      );
      res.status(200).json({
        status: 'success',
        message: 'Bypass rejected. Worker must re-enter correct quantities.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const bypassId = Validation.validate(
        BypassRequestValidation.ID_PARAM,
        req.params.id,
      );

      const result = await BypassRequestService.getById(
        req.staff!.role,
        req.staff!.outletId ?? undefined,
        bypassId,
      );

      res.status(200).json({
        status: 'success',
        message: 'Bypass request retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
