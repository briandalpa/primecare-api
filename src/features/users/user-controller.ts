import { Validation } from '@/validations/validation';
import { UserValidation } from '@/validations/user-validation';
import { NextFunction, Request, Response } from 'express';
import { UserService } from './user-service';
import { UserRequest } from '@/types/user-request';

export class UserController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = Validation.validate(UserValidation.REGISTER, req.body);
      const result = await UserService.register(data);
      res.status(201).json({ status: 'success', message: 'Registration successful. Check your email to set your password.', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async setPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const data = Validation.validate(UserValidation.SET_PASSWORD, req.body);
      const result = await UserService.setPassword(data);
      res.status(200).json({ status: 'success', message: result.message });
    } catch (error) {
      next(error);
    }
  }

  static async resendVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const data = Validation.validate(UserValidation.RESEND_VERIFICATION, req.body);
      const result = await UserService.resendVerification(data);
      res.status(200).json({ status: 'success', message: result.message });
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const result = await UserService.getMe(req.user!.id);
      res.status(200).json({ status: 'success', message: 'Profile retrieved', data: result });
    } catch (error) {
      next(error);
    }
  }
}
