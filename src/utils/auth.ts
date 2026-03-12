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
  trustedOrigins: [process.env.FRONTEND_URL ?? 'http://localhost:5173'],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Staff use a custom token-based password setup, not better-auth's built-in verification.
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

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
    updateAge: 60 * 60 * 24, // Extend session expiry once per day to avoid forcing re-login too often.
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
    sendOnSignUp: false, // Verification emails are triggered manually, not on registration.
    disableAutoSignIn: true, // Prevents an automatic session from being created after email verification.
  },
});
