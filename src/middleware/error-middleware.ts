import type { Response, Request, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ResponseError } from '@/error/response-error';
import { logger } from '@/application/logging';

export const errorMiddleware = async (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (error instanceof ZodError) {
    // Return only field paths and messages; never expose the full ZodError internals.
    res.status(400).json({
      errors: error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  } else if (error instanceof ResponseError) {
    // Expected business logic error thrown with an explicit HTTP status code.
    res.status(error.status).json({
      errors: error.message,
    });
  } else {
    // Log the real error server-side; return a generic message to the client
    // to avoid leaking DB internals, stack traces, or constraint names.
    logger.error({ message: error.message, stack: error.stack });
    res.status(500).json({
      errors: 'Internal server error',
    });
  }
};
