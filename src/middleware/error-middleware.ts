import type { Response, Request, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ResponseError } from '@/error/response-error';
import { logger } from '@/application/logging';

const handleZodError = (error: ZodError, res: Response): void => {
  // Return only field paths and messages; never expose the full ZodError internals.
  res.status(400).json({
    status:  'error',
    message: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  });
};

const handleResponseError = (error: ResponseError, res: Response): void => {
  // Expected business logic error thrown with an explicit HTTP status code.
  res.status(error.status).json({ status: 'error', message: error.message });
};

const handleUnknownError = (error: Error, res: Response): void => {
  // Log the real error server-side; return a generic message to the client
  // to avoid leaking DB internals, stack traces, or constraint names.
  logger.error({ message: error.message, stack: error.stack });
  res.status(500).json({ status: 'error', message: 'Internal server error' });
};

export const errorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (error instanceof ZodError)      return handleZodError(error, res);
  if (error instanceof ResponseError) return handleResponseError(error, res);
  handleUnknownError(error, res);
};
