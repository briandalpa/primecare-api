import { Response, NextFunction } from "express";
import { BypassRequestService } from "./bypass-request-service";
import { Validation } from "../../validations/validation";
import { BypassRequestValidation } from "../../validations/bypass-request-validation";
import { UserRequest } from "../../types/user-request";

export class BypassRequestController {
  static async create(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const request = Validation.validate(
        BypassRequestValidation.CREATE,
        req.body
      );

      if (!req.staff) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }

      const result = await BypassRequestService.create(
        req.staff.id,
        request
      );

      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  }
}