import { NextFunction, Response } from 'express';
import { WorkerNotificationService } from './worker-notification-service';
import { UserRequest } from '@/types/user-request';

export class WorkerNotificationController {
  static async stream(req: UserRequest, res: Response, next: NextFunction) {
    try {
      await WorkerNotificationService.subscribe(req.staff!, req, res);
    } catch (error) {
      next(error);
    }
  }
}
