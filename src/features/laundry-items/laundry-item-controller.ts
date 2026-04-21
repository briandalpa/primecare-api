import { NextFunction, Request, Response } from 'express';
import { LaundryItemService } from './laundry-item-service';

export class LaundryItemController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await LaundryItemService.listActive();

      res.status(200).json({
        status: 'success',
        message: 'Laundry items retrieved',
        data: items,
      });
    } catch (error) {
      next(error);
    }
  }
}
