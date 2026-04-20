import type { NextFunction, Response } from 'express';
import type { UserRequest } from '@/types/user-request';
import { Validation } from '@/validations/validation';
import { ShiftValidation } from '@/validations/shift-validation';
import { ShiftService } from './shift-service';

export class ShiftController {
  static async create(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const data = Validation.validate(ShiftValidation.CREATE, req.body);
      const result = await ShiftService.createShift(req.staff!, data);

      res.status(201).json({
        status: 'success',
        message: 'Shift created successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const query = Validation.validate(ShiftValidation.LIST, req.query);
      const result = await ShiftService.getShifts(req.staff!, query);

      res.status(200).json({
        status: 'success',
        message: 'Shifts retrieved successfully',
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  static async end(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const shiftId = Validation.validate(ShiftValidation.ID_PARAM, req.params.id);
      const result = await ShiftService.endShift(req.staff!, shiftId);

      res.status(200).json({
        status: 'success',
        message: 'Shift ended successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}