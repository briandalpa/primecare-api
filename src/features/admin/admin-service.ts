import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import { Staff } from '@/generated/prisma/client';
import { sendEmail } from '@/utils/mailer';
import { v4 as uuid } from 'uuid';
import { CreateAdminUserInput, UpdateAdminUserInput, toAdminUserResponse } from './admin-model';

// Returns all staff users across every outlet; used by SUPER_ADMIN only.
const fetchAllUsers = async () => {
  const users = await prisma.user.findMany({ include: { staff: true }, orderBy: { createdAt: 'desc' } });
  return users.map(toAdminUserResponse);
};

// Returns staff scoped to a single outlet; used by OUTLET_ADMIN to see only their own team.
const fetchOutletUsers = async (outletId: string) => {
  const users = await prisma.user.findMany({
    where: { staff: { outletId } },
    include: { staff: true },
    orderBy: { createdAt: 'desc' },
  });
  return users.map(toAdminUserResponse);
};

const createUserAndStaff = async (data: CreateAdminUserInput) => {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new ResponseError(409, 'Email already registered');

  const user = await prisma.user.create({
    data: { id: uuid(), name: data.name, email: data.email, emailVerified: false }, // stays false until the staff member sets their password
  });

  await prisma.staff.create({
    data: { id: uuid(), userId: user.id, role: data.role, outletId: data.outletId ?? null, isActive: true },
  });

  return user;
};

// Generates a UUID token stored in the Verification table that expires in 1 hour.
// The staff member uses this token to set their password via the invite link.
const createInviteToken = async (email: string) => {
  const token = uuid();
  await prisma.verification.create({
    data: { id: uuid(), identifier: email, value: token, expiresAt: new Date(Date.now() + 3600 * 1000) },
  });
  return token;
};

const sendInviteEmail = (email: string, token: string) => {
  const link = `${process.env.FRONTEND_URL}/set-password?token=${token}`;
  void sendEmail({ // Non-blocking: email delivery failure should not fail the request.
    to: email,
    subject: 'Set your PrimeCare password',
    html: `<p>You have been invited to PrimeCare.</p>
           <p>Click the link below to set your password. This link expires in 1 hour.</p>
           <p><a href="${link}">${link}</a></p>`,
  });
};

export class AdminService {
  // Scopes the result set by role: SUPER_ADMIN sees all staff, OUTLET_ADMIN sees only their outlet.
  static async getAdminUsers(staff: Pick<Staff, 'role' | 'outletId'>) {
    if (staff.role === 'SUPER_ADMIN') return fetchAllUsers();
    if (staff.role === 'OUTLET_ADMIN' && staff.outletId) return fetchOutletUsers(staff.outletId);
    throw new ResponseError(403, 'Forbidden');
  }

  // Creates User and Staff records, issues a 1-hour invite token, then sends the password-setup email.
  static async createAdminUser(data: CreateAdminUserInput) {
    const user = await createUserAndStaff(data);
    const token = await createInviteToken(data.email);
    sendInviteEmail(data.email, token);
    return { id: user.id, name: user.name, email: user.email, role: data.role };
  }

  static async updateAdminUser(userId: string, data: UpdateAdminUserInput) {
    const staff = await prisma.staff.findUnique({ where: { userId } });
    if (!staff) throw new ResponseError(404, 'User staff not found');

    return prisma.staff.update({
      where: { userId },
      data: { role: data.role ?? staff.role, outletId: data.outletId ?? staff.outletId, isActive: data.isActive ?? staff.isActive },
    });
  }

  // Deletes both the Staff and User records to fully remove the account.
  static async deleteAdminUser(userId: string) {
    const staff = await prisma.staff.findUnique({ where: { userId } });
    if (!staff) throw new ResponseError(404, 'User staff not found');

    await prisma.staff.delete({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    return { message: 'User deleted successfully' };
  }
}
