import { Response } from 'express';
import { BypassRequestService } from './bypass-request-service';
import { UserRequest } from '@/types/user-request';
import { Validation } from '@/validations/validation';
import {
  approveBypassSchema,
  rejectBypassSchema,
} from './bypass-request-model';

export class BypassRequestController {
  static async approve(req: UserRequest, res: Response) {
    const user = req.user;

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
    const user = req.user;

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