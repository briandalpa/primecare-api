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

// Vercel routes all requests through a proxy that sets X-Forwarded-For.
// Trust one hop so express-rate-limit can correctly identify client IPs.
app.set('trust proxy', 1);

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

app.use(
  '/api/auth',
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use(
  '/api/v1',
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

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
