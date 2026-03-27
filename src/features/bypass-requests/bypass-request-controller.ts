import { Request, Response } from "express";
import { prisma } from "@/application/database";
import { ResponseError } from "@/error/response-error";
import { BypassRequestService } from "./bypass-request-service";
import { CreateBypassRequestInput } from "./bypass-request-model";

export class BypassRequestController {
  static async create(req: Request, res: Response) {
    //FIX: pakai any supaya tidak ubah typing project
    const user = (req as any).user;

    if (!user) {
      throw new ResponseError(401, "Unauthorized");
    }

    //FIX: mapping user → staff
    const staff = await prisma.staff.findUnique({
      where: { userId: user.id },
    });

    if (!staff) {
      throw new ResponseError(404, "Staff not found");
    }

    const request: CreateBypassRequestInput = req.body;

    const result = await BypassRequestService.create(
      staff.id, //
      request
    );

    res.status(200).json(result);
  }

  static async approve(req: Request, res: Response) {
    const user = (req as any).user;

    if (!user) {
      throw new ResponseError(401, "Unauthorized");
    }

    const staff = await prisma.staff.findUnique({
      where: { userId: user.id },
    });

    if (!staff) {
    throw new ResponseError(404, "Staff not found");
    }

  const id = req.params.id as string;

  const result = await BypassRequestService.approve(
    staff.id,
    id
    );

    res.status(200).json(result);
  }

    static async findAll(req: Request, res: Response) {
  const user = (req as any).user;

  if (!user) {
    throw new ResponseError(401, "Unauthorized");
  }

  const staff = await prisma.staff.findUnique({
    where: { userId: user.id },
  });

  if (!staff) {
    throw new ResponseError(404, "Staff not found");
  }

  const result = await BypassRequestService.findAll(
    staff.id,
    staff.role,
    staff.outletId ?? undefined
  );

  res.status(200).json(result);
}
}