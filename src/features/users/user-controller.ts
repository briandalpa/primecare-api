import { Validation } from '@/validations/validation';
import { NextFunction, Request, Response } from 'express';
import { RegisterSchema, ResendVerificationSchema, SetPasswordSchema } from './user-model';
import { UserService } from './user-service';

export class UserController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = Validation.validate(RegisterSchema, req.body);
      const result = await UserService.register(data);
      res.status(201).json({ status: 'success', message: 'Registration successful. Check your email to set your password.', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async setPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const data = Validation.validate(SetPasswordSchema, req.body);
      const result = await UserService.setPassword(data);
      res.status(200).json({ status: 'success', message: result.message });
    } catch (error) {
      next(error);
    }
  }

  static async resendVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const data = Validation.validate(ResendVerificationSchema, req.body);
      const result = await UserService.resendVerification(data);
      res.status(200).json({ status: 'success', message: result.message });
    } catch (error) {
      next(error);
    }
  }
}
