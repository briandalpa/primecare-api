import { Response, NextFunction } from 'express';
import { ComplaintService } from './complaint-service';
import { Validation } from '@/validations/validation';
import { ComplaintValidation } from '@/validations/complaint-validation';
import { UserRequest } from '@/types/user-request';

export class ComplaintController {
  static async create(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const body = Validation.validate(ComplaintValidation.CREATE, req.body);
      const result = await ComplaintService.create(req.user!.id, body);
      res.status(201).json({ status: 'success', message: 'Complaint submitted', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const query = Validation.validate(ComplaintValidation.LIST, req.query);
      const result = await ComplaintService.list(req.staff?.role, req.user!.id, req.staff?.outletId, query);
      res.status(200).json({ status: 'success', message: 'Complaints retrieved', data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const complaintId = Validation.validate(ComplaintValidation.ID_PARAM, req.params.id);
      const result = await ComplaintService.getById(
        req.staff?.role,
        req.user!.id,
        req.staff?.outletId,
        complaintId,
      );
      res.status(200).json({ status: 'success', message: 'Complaint retrieved', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const complaintId = Validation.validate(ComplaintValidation.ID_PARAM, req.params.id);
      const body = Validation.validate(ComplaintValidation.UPDATE_STATUS, req.body);
      const result = await ComplaintService.updateStatus(
        req.staff!.role,
        req.staff!.outletId,
        complaintId,
        body,
      );
      res.status(200).json({ status: 'success', message: 'Complaint status updated', data: result });
    } catch (error) {
      next(error);
    }
  }
}
