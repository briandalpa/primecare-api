import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import { v4 as uuid } from 'uuid';
import { DashboardStatsResponse, RegisterInput, ResendVerificationInput, SetPasswordInput, toUserResponse } from './user-model';
import { createVerificationToken, sendSetPasswordEmail, verifyToken, createCredentialAccount, fetchDashboardData } from './user-helper';

export class UserService {
  static async register(data: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ResponseError(409, 'Email already registered');

    const user = await prisma.user.create({
      data: { id: uuid(), name: data.name, email: data.email, emailVerified: false },
    });

    const token = await createVerificationToken(data.email);
    sendSetPasswordEmail(data.email, token);

    return toUserResponse(user);
  }

  static async setPassword(data: SetPasswordInput) {
    const verification = await verifyToken(data.token);
    const user = await prisma.user.findUnique({ where: { email: verification.identifier } });
    if (!user) throw new ResponseError(404, 'User not found');

    const existingAccount = await prisma.account.findFirst({ where: { userId: user.id, providerId: 'credential' } });
    if (existingAccount) throw new ResponseError(409, 'Password already set'); // Prevents overwriting an existing password via token replay.

    await createCredentialAccount(user.id, data.password);
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } }); // Email is considered verified once the user sets their password.
    await prisma.verification.delete({ where: { id: verification.id } }); // Token is single-use; delete it to prevent reuse.

    return { message: 'Password set successfully' };
  }

  static async resendVerification(data: ResendVerificationInput) {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) return { message: 'Verification email sent' }; // Silent success: avoids leaking whether an email is registered.

    const existingAccount = await prisma.account.findFirst({ where: { userId: user.id, providerId: 'credential' } });
    if (existingAccount) throw new ResponseError(409, 'Account already verified');

    const token = await createVerificationToken(data.email);
    sendSetPasswordEmail(data.email, token);
    return { message: 'Verification email sent' };
  }

  static async getDashboardStats(outletId: string | null): Promise<DashboardStatsResponse> {
    const outletFilter = outletId ? { outletId } : {};
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [totalOrders, activeOutlets, registeredUsers, revenueResult, recentOrders] = await fetchDashboardData(outletFilter, startOfMonth);
    return {
      totalOrders,
      activeOutlets,
      registeredUsers,
      revenueMtd: revenueResult._sum.totalPrice ?? 0,
      recentOrders: recentOrders.map((o) => ({ id: o.id, customerName: o.pickupRequest.customerUser.name ?? 'Unknown', status: o.status, outletName: o.outlet.name, createdAt: o.createdAt })),
    };
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { staff: true } });
    if (!user) throw new ResponseError(404, 'User not found');

    return {
      id: user.id,
      name: user.name ?? '',
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.staff?.role ?? 'CUSTOMER', // A User without a Staff record is implicitly a CUSTOMER.
      image: user.image,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      createdAt: user.createdAt,
      staff: user.staff
        ? { role: user.staff.role, workerType: user.staff.workerType, outletId: user.staff.outletId, isActive: user.staff.isActive }
        : null,
    };
  }
}
