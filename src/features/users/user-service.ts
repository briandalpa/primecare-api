import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import { sendEmail } from '@/utils/mailer';
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { RegisterInput, ResendVerificationInput, SetPasswordInput, toUserResponse } from './user-model';

const createVerificationToken = async (email: string): Promise<string> => {
  await prisma.verification.deleteMany({ where: { identifier: email } });
  const token = uuid();
  await prisma.verification.create({
    data: { id: uuid(), identifier: email, value: token, expiresAt: new Date(Date.now() + 3600 * 1000) },
  });
  return token;
};

const sendSetPasswordEmail = (email: string, token: string) => {
  const link = `${process.env.FRONTEND_URL}/auth/set-password?token=${token}`;
  void sendEmail({
    to: email,
    subject: 'Set your PrimeCare password',
    html: `<p>Click the link below to set your password. This link expires in 1 hour.</p>
           <p><a href="${link}">${link}</a></p>`,
  });
};

const verifyToken = async (token: string) => {
  const verification = await prisma.verification.findFirst({ where: { value: token } });
  if (!verification || verification.expiresAt < new Date()) {
    throw new ResponseError(400, 'Invalid or expired token');
  }
  return verification;
};

const createCredentialAccount = async (userId: string, password: string) => {
  const hash = await bcrypt.hash(password, 10);
  await prisma.account.create({
    data: { id: uuid(), accountId: userId, providerId: 'credential', userId, password: hash },
  });
};

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
    if (existingAccount) throw new ResponseError(409, 'Password already set');

    await createCredentialAccount(user.id, data.password);
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    await prisma.verification.delete({ where: { id: verification.id } });

    return { message: 'Password set successfully' };
  }

  static async resendVerification(data: ResendVerificationInput) {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) return { message: 'Verification email sent' };

    const existingAccount = await prisma.account.findFirst({ where: { userId: user.id, providerId: 'credential' } });
    if (existingAccount) throw new ResponseError(409, 'Account already verified');

    const token = await createVerificationToken(data.email);
    sendSetPasswordEmail(data.email, token);
    return { message: 'Verification email sent' };
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { staff: true } });
    if (!user) throw new ResponseError(404, 'User not found');

    return {
      id: user.id,
      name: user.name ?? '',
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.staff?.role ?? 'CUSTOMER',
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
