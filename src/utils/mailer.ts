import nodemailer from 'nodemailer';
import { logger } from '@/application/logging';

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async (options: { to: string; subject: string; html: string }) => {
  const info = await transporter.sendMail({
    from: `"PrimeCare" <${process.env.SMTP_FROM}>`,
    ...options,
  });
  // Ethereal only — logs clickable preview URL in development
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    logger.info(`Email preview (To: ${options.to}): ${previewUrl}`);
  }
};
