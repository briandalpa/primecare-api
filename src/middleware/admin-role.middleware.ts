import { Response, NextFunction } from "express";
import { UserRole } from "../generated/prisma/enums";
import { UserRequest } from "@/types/user-request";

export function adminRoleMiddleware(
  req: UserRequest,
  res: Response,
  next: NextFunction
) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  if (
    user.role !== UserRole.SUPER_ADMIN &&
    user.role !== UserRole.OUTLET_ADMIN
  ) {
    return res.status(403).json({
      message: "Forbidden: Admin access only",
    });
  }

  next();
}