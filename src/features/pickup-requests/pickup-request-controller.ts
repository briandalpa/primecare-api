import { Response } from 'express';
import { Validation } from '@/validations/validation';
import { ResponseError } from '@/error/response-error';
import { PickupRequestValidation } from '@/validations/pickup-request-validation';
import { PickupRequestService } from './pickup-request-service';
import type { UserRequest } from '@/types/user-request';

export class PickupRequestController {
  static async create(req: UserRequest, res: Response) {
    const input = Validation.validate(PickupRequestValidation.CREATE, req.body);
    const response = await PickupRequestService.createPickupRequest(req.user!.id, input);
    res.status(201).json({
      status: 'success',
      message: 'Pickup request created',
      data: response,
    });
  }

  static async list(req: UserRequest, res: Response) {
    if (!req.staff!.outletId) {
      throw new ResponseError(409, 'Driver is not assigned to any outlet');
    }

    const query = Validation.validate(PickupRequestValidation.LIST, req.query);
    const response = await PickupRequestService.listUnassignedRequests(req.staff!.outletId, query);

    res.json({
      status: 'success',
      message: 'Pickup requests retrieved',
      data: response.data,
      pagination: response.pagination,
    });
  }

  static async accept(req: UserRequest, res: Response) {
    if (!req.staff!.outletId) {
      throw new ResponseError(409, 'Driver is not assigned to any outlet');
    }

    const pickupRequestId = Validation.validate(
      PickupRequestValidation.ID_PARAM,
      req.params.id
    );
    const response = await PickupRequestService.acceptPickupRequest(
      req.staff!.id,
      pickupRequestId,
      req.staff!.outletId
    );
    res.json({
      status: 'success',
      message: 'Pickup request accepted',
      data: response,
    });
  }
}
