import { auth } from '@/utils/auth';
import cors from 'cors';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';

export const app = express();

// CORS middleware
app.use(
  cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  }),
);

// better-auth handler (must be before express.json())
app.all('/api/auth/*', toNodeHandler(auth));

app.use(express.json());
