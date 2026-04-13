import { Response, NextFunction } from 'express';
import { BypassRequestService } from './bypass-request-service';
import { Validation } from '@/validations/validation';
import { BypassRequestValidation } from '@/validations/bypass-request-validation';
import { UserRequest } from '@/types/user-request';
import type { StationType } from '@/generated/prisma/client';

export class BypassRequestController {
  static async create(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const station = Validation.validate(
        BypassRequestValidation.STATION_PARAM,
        req.params.station
      ) as StationType;

      const request = Validation.validate(
        BypassRequestValidation.CREATE,
        req.body
      );

      const result = await BypassRequestService.create(
        req.staff!.id,
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
}