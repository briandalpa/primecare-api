import { prisma } from '@/application/database';
import { UserRole } from '@/generated/prisma/enums';
import { UserRequest } from '@/types/user-request';
import { auth } from '@/utils/auth';
import { fromNodeHeaders } from 'better-auth/node';
import { NextFunction, Response } from 'express';

export const requireAuth = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    req.user = user;
    req.session = session.session;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...roles: UserRole[]) => {
  return async (req: UserRequest, res: Response, next: NextFunction) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
      });

      if (!user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      if (!roles.includes(user.role)) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }

      req.user = user;
      req.session = session.session;
      next();
    } catch (error) {
      next(error);
    }
  };
};
