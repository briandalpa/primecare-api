import { Response } from 'express';
import { DriverService } from './driver-service';
import type { UserRequest } from '@/types/user-request';

export class DriverController {
  static async getActiveTask(req: UserRequest, res: Response) {
    const response = await DriverService.getActiveTask(req.staff!.id);
    res.json({ status: 'success', message: 'Active task retrieved', data: response });
  }
}
