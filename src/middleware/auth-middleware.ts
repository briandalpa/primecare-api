import { prisma } from '@/application/database';
import { StaffRole } from '@/generated/prisma/enums';
import { UserRequest } from '@/types/user-request';
import { auth } from '@/utils/auth';
import { fromNodeHeaders } from 'better-auth/node';
import { NextFunction, Response } from 'express';

// Extracts the better-auth session from request headers and verifies the user still exists in the DB.
const getSessionUser = async (req: UserRequest) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) return null;

  // Re-query the DB to prevent orphaned sessions (user deleted after token was issued).
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) return null;

  return { user, session: session.session };
};

// Use on customer routes. Verifies the session and attaches req.user before calling next().
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

// Use on staff routes where any staff role is allowed. Attaches req.user and req.staff.
// Also rejects deactivated staff accounts regardless of valid session.
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

    // A user without a Staff record is a customer and must not access staff routes.
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

// Use on customer-only routes. Rejects staff members who might otherwise impersonate customers.
export const requireCustomerAuth = async (
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

    const staff = await prisma.staff.findUnique({ where: { userId: result.user.id } });
    if (staff) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    req.user = result.user;
    req.session = result.session;
    next();
  } catch (error) {
    next(error);
  }
};

// Factory: returns a middleware that restricts access to staff with one of the given roles.
// Usage: requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN')
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

      // Inactive staff lose access even if their session is still valid.
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
