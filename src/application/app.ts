import express from 'express';
import cors from 'cors';

export const app = express();

// CORS middleware
app.use(
  cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
  }),
);

app.use(express.json());
