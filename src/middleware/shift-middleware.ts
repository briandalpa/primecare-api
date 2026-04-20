import { prisma } from '@/application/database';
import type { NextFunction, Response } from 'express';
import type { UserRequest } from '@/types/user-request';

export const requireActiveWorkerShift = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const activeShift = await prisma.shift.findFirst({
      where: { staffId: req.staff!.id, endTime: null },
    });

    if (!activeShift) {
      res.status(403).json({ errors: 'Worker is not on an active shift' });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};