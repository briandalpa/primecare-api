import { Validation } from '@/validations/validation';
import { AdminValidation } from '@/validations/admin-validation';
import { NextFunction, Response } from 'express';
import { UserRequest } from '@/types/user-request';
import { AdminService } from './admin-service';

export class AdminController {
  static async getAdminUsers(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const users = await AdminService.getAdminUsers(req.staff!);
      res.status(200).json({ status: 'success', message: 'Users retrieved successfully', data: users });
    } catch (error) {
      next(error);
    }
  }

  static async createAdminUser(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const data = Validation.validate(AdminValidation.CREATE, req.body);
      const result = await AdminService.createAdminUser(data);
      res.status(201).json({ status: 'success', message: 'Admin user created', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async updateAdminUser(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const data = Validation.validate(AdminValidation.UPDATE, req.body);
      const result = await AdminService.updateAdminUser(req.params['id'] as string, data);
      res.status(200).json({ status: 'success', message: 'Admin user updated', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async deleteAdminUser(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const result = await AdminService.deleteAdminUser(req.params['id'] as string);
      res.status(200).json({ status: 'success', message: result.message });
    } catch (error) {
      next(error);
    }
  }
}
