import { prisma } from '@/application/database';
import { sendEmail } from '@/utils/mailer';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import bcrypt from 'bcrypt';

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? 'http://localhost:5173'],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    password: {
      hash: async (password) => bcrypt.hash(password, 10),
      verify: async ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: 'Verify your PrimeCare email address',
        html: `<p>Click the link below to verify your email. This link expires in 1 hour.</p>
               <p><a href="${url}">${url}</a></p>`,
      });
    },
    expiresIn: 3600,
    sendOnSignUp: false,
    disableAutoSignIn: true,
  },
});
