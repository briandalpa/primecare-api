import { errorMiddleware } from '@/middleware/error-middleware';
import { apiRouter } from '@/routes/api';
import { publicRouter } from '@/routes/public-api';
import { auth } from '@/utils/auth';
import cors from 'cors';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

export const app = express();

// Security headers first; sets X-Content-Type-Options, X-Frame-Options, HSTS, etc.
app.use(helmet());

app.use(
  cors({
    // Use the same origin as better-auth's trustedOrigins to keep both in sync.
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  }),
);

// Strict limit on auth routes to mitigate credential brute-force attacks.
app.use('/api/auth', rateLimit({ windowMs: 10 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false }));
// Moderate limit on all API routes to prevent abuse and DoS.
app.use('/api/v1', rateLimit({ windowMs: 10 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));

// Critical ordering: better-auth must be before express.json() to handle raw request bodies.
// better-auth manages all /api/auth/* routes including sign-in, sign-up, OAuth callbacks.
app.all('/api/auth/*splat', toNodeHandler(auth));

// Explicit body size limit prevents excessively large payloads from reaching route handlers.
app.use(express.json({ limit: '100kb' }));

// publicRouter = unauthenticated routes (webhooks, password reset, etc.)
// apiRouter = authenticated routes (requireAuth or requireStaffAuth middleware applied)
app.use('/api/v1', publicRouter);
app.use('/api/v1', apiRouter);

app.use(errorMiddleware);
