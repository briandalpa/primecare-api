import { Request, Response, NextFunction } from "express";
import { BypassRequestService } from "./bypass-request-service";

import { Validation } from "../../validations/validation";
import { BypassRequestValidation } from "../../validations/bypass-request-validation";

export class BypassRequestController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const request = Validation.validate(
        BypassRequestValidation.CREATE,
        req.body
      );

      const result = await BypassRequestService.create(
        (req as any).user.id, // FIX
        request
      );

      res.status(201).json(result); // FIX 201
    } catch (e) {
      next(e);
    }
  }
}
