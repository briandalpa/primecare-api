import { prisma } from '@/application/database';
import { StaffRole } from '@/generated/prisma/enums';
import { UserRequest } from '@/types/user-request';
import { auth } from '@/utils/auth';
import { fromNodeHeaders } from 'better-auth/node';
import { NextFunction, Response } from 'express';

const getSessionUser = async (req: UserRequest) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) return null;

  return { user, session: session.session };
};

export const requireAuth = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await getSessionUser(req);
    if (!result) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    req.user = result.user;
    req.session = result.session;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireStaffAuth = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await getSessionUser(req);
    if (!result) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const staff = await prisma.staff.findUnique({
      where: { userId: result.user.id },
    });

    if (!staff || !staff.isActive) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    req.user = result.user;
    req.staff = staff;
    req.session = result.session;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireStaffRole = (...roles: StaffRole[]) => {
  return async (req: UserRequest, res: Response, next: NextFunction) => {
    try {
      const result = await getSessionUser(req);
      if (!result) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const staff = await prisma.staff.findUnique({
        where: { userId: result.user.id },
      });

      if (!staff || !staff.isActive) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }

      if (!roles.includes(staff.role)) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }

      req.user = result.user;
      req.staff = staff;
      req.session = result.session;
      next();
    } catch (error) {
      next(error);
    }
  };
};
