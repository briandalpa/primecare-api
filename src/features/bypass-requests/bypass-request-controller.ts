import { Response, NextFunction } from 'express';
import { BypassRequestService } from './bypass-request-service';
import { Validation } from '@/validations/validation';
import { BypassRequestValidation } from '@/validations/bypass-request-validation';
import { UserRequest } from '@/types/user-request';
import { ResponseError } from '@/error/response-error';
import type { StationType } from '@/generated/prisma/client';
import { BypassStatus } from './bypass-request-model';

export class BypassRequestController {
  static async create(req: UserRequest, res: Response, next: NextFunction) {
    try {
      if (!req.staff) {
        throw new ResponseError(401, 'Authentication required');
      }

      const station = Validation.validate(
        BypassRequestValidation.STATION_PARAM,
        req.params.station
      ) as StationType;

      const request = Validation.validate(
        BypassRequestValidation.CREATE,
        req.body
      );

      const result = await BypassRequestService.create(
        req.staff.id,
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        station,
        request
      );

      res.status(201).json({
        status: 'success',
        message: 'Bypass request submitted. Awaiting admin approval.',
        data: result,
      });
    } catch (e) {
      next(e);
    }
  }

  // PCS-128: Get bypass requests for admin review
  static async getAll(req: UserRequest, res: Response, next: NextFunction) {
    try {
      if (!req.staff) {
        throw new ResponseError(401, 'Authentication required');
      }

      const rawPage = Number(req.query.page);
      const rawLimit = Number(req.query.limit);
      const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
      const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : 10;

      let status: BypassStatus | undefined;
      if (req.query.status) {
        status = Validation.validate(
          BypassRequestValidation.STATUS_ENUM,
          req.query.status
        );
      }

      let order: 'asc' | 'desc' = 'desc';
      if (req.query.order) {
        order = Validation.validate(BypassRequestValidation.ORDER, req.query.order);
      }

      const result = await BypassRequestService.getAll(
        req.staff.id,
        req.staff.role,
        req.staff.outletId ?? undefined,
        { page, limit, status, order }
      );

      res.status(200).json({
        status: 'success',
        message: 'Bypass requests retrieved',
        data: result.data,
        meta: result.meta,
      });
    } catch (e) {
      next(e);
    }
  }
}