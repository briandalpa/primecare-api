import { errorMiddleware } from '@/middleware/error-middleware';
import { apiRouter } from '@/routes/api';
import { publicRouter } from '@/routes/public-api';
import { auth } from '@/utils/auth';
import cors from 'cors';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';

export const app = express();

app.use(
  cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  }),
);

// Critical ordering: better-auth must be before express.json() to handle raw request bodies.
// better-auth manages all /api/auth/* routes including sign-in, sign-up, OAuth callbacks.
app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());

// publicRouter = unauthenticated routes (webhooks, password reset, etc.)
// apiRouter = authenticated routes (requireAuth or requireStaffAuth middleware applied)
app.use('/api/v1', publicRouter);
app.use('/api/v1', apiRouter);

app.use(errorMiddleware);
