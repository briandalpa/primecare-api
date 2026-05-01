import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import { sendEmail } from '@/utils/mailer';
import bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid';

// Store SHA-256 of the token in the DB; email the raw token.
// If the verification table is compromised, hashes are useless without the raw token.
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

// Clears any existing tokens for this email before issuing a new one, preventing stale links.
export const createVerificationToken = async (email: string): Promise<string> => {
  await prisma.verification.deleteMany({ where: { identifier: email } });
  const token = uuid();
  await prisma.verification.create({
    data: { id: uuid(), identifier: email, value: hashToken(token), expiresAt: new Date(Date.now() + 3600 * 1000) }, // expires in 1 hour
  });
  return token; // Return raw token for email delivery; only the hash is persisted.
};

export const sendSetPasswordEmail = (email: string, token: string) => {
  const link = `${process.env.FRONTEND_URL}/auth/set-password?token=${token}`;
  void sendEmail({ // Non-blocking: email delivery failure should not fail the request.
    to: email,
    subject: 'Set your PrimeCare password',
    html: `<p>Click the link below to set your password. This link expires in 1 hour.</p>
           <p><a href="${link}">${link}</a></p>`,
  });
};

// Validates token existence and expiry in one query; throws if either check fails.
export const verifyToken = async (token: string) => {
  const verification = await prisma.verification.findFirst({ where: { value: hashToken(token) } });
  if (!verification || verification.expiresAt < new Date()) {
    throw new ResponseError(400, 'Invalid or expired token');
  }
  return verification;
};

export const createCredentialAccount = async (userId: string, password: string) => {
  const hash = await bcrypt.hash(password, 10);
  await prisma.account.create({
    data: { id: uuid(), accountId: userId, providerId: 'credential', userId, password: hash },
  });
};

export function fetchDashboardData(outletFilter: { outletId?: string }, startOfMonth: Date) {
  return prisma.$transaction([
    prisma.order.count({ where: outletFilter }),
    prisma.outlet.count({ where: { isActive: true } }),
    prisma.user.count({ where: { staff: null } }),
    prisma.order.aggregate({ _sum: { totalPrice: true }, where: { ...outletFilter, paymentStatus: 'PAID', createdAt: { gte: startOfMonth } } }),
    prisma.order.findMany({
      where: outletFilter,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, status: true, createdAt: true, outlet: { select: { name: true } }, pickupRequest: { select: { customerUser: { select: { name: true } } } } },
    }),
  ]);
}
