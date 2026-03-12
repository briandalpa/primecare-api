import type { Response, Request, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ResponseError } from '@/error/response-error';

export const errorMiddleware = async (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (error instanceof ZodError) {
    // Input validation failure from Validation.validate(); always returns 400.
    res.status(400).json({
      errors: `Validation Error: ${JSON.stringify(error)}`,
    });
  } else if (error instanceof ResponseError) {
    // Expected business logic error thrown with an explicit HTTP status code.
    res.status(error.status).json({
      errors: error.message,
    });
  } else {
    // Unhandled or unexpected error; always returns 500.
    res.status(500).json({
      errors: error.message,
    });
  }
};
