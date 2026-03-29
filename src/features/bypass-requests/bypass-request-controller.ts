import { Response } from "express";
import { BypassRequestService } from "./bypass-request-service";
import { CreateBypassRequestInput } from "./bypass-request-model";
import { ResponseError } from "../../error/response-error";
import { UserRequest } from "../../types/user-request";

export class BypassRequestController {
  static async create(req: UserRequest, res: Response) {
    const staff = req.staff;

    if (!staff) {
      throw new ResponseError(401, "Unauthorized");
    }

    const request: CreateBypassRequestInput = req.body;

    const result = await BypassRequestService.create(
      staff.id,
      request
    );

    res.status(200).json(result);
  }

  static async findAll(req: UserRequest, res: Response) {
    const staff = req.staff;

    if (!staff) {
      throw new ResponseError(401, "Unauthorized");
    }

    const result = await BypassRequestService.findAll(
      staff.id,
      staff.role,
      staff.outletId ?? undefined
    );

    res.status(200).json(result);
  }

  static async approve(req: UserRequest, res: Response) {
    const staff = req.staff;

    if (!staff) {
      throw new ResponseError(401, "Unauthorized");
    }

    const bypassId = req.params.id as string;
    const { problemDescription } = req.body;

    if (!problemDescription) {
      throw new ResponseError(400, "problemDescription is required");
    }

    const result = await BypassRequestService.approve(
      staff.id,
      bypassId,
      problemDescription
    );

    res.status(200).json(result);
  }
}