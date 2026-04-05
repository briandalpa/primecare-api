import { Response } from 'express';
import { BypassRequestService } from './bypass-request-service';
import { UserRequest } from '@/types/user-request';
import { Validation } from '@/validations/validation';
import { ResponseError } from '@/error/response-error';
import {
  approveBypassSchema,
  rejectBypassSchema,
} from './bypass-request-model';

export class BypassRequestController {
  static async approve(req: UserRequest, res: Response) {
    if (!req.user || !req.user.id) {
      throw new ResponseError(401, 'Unauthorized');
    }

    const user = {
      id: req.user.id,
    };

    const request = Validation.validate(
      approveBypassSchema,
      req.body
    );

    const bypassId = req.params.id as string;

    const result = await BypassRequestService.approve(
      user,
      bypassId,
      request
    );

    res.json({
      data: result,
    });
  }

  static async reject(req: UserRequest, res: Response) {
    if (!req.user || !req.user.id) {
      throw new ResponseError(401, 'Unauthorized');
    }

    const user = {
      id: req.user.id,
    };

    const request = Validation.validate(
      rejectBypassSchema,
      req.body
    );

    const bypassId = req.params.id as string;

    const result = await BypassRequestService.reject(
      user,
      bypassId,
      request
    );

    res.json({
      data: result,
    });
  }
}