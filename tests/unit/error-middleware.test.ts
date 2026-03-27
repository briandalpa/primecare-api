import { errorMiddleware } from '@/middleware/error-middleware';
import { ResponseError } from '@/error/response-error';
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

describe('errorMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('should handle ResponseError with 400 status', () => {
    const error = new ResponseError(400, 'Validation error');
    errorMiddleware(error, req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ errors: 'Validation error' });
  });

  it('should handle ResponseError with 401 status', () => {
    const error = new ResponseError(401, 'Unauthorized');
    errorMiddleware(error, req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ errors: 'Unauthorized' });
  });

  it('should handle ResponseError with 500 status', () => {
    const error = new ResponseError(500, 'Internal Server Error');
    errorMiddleware(error, req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ errors: 'Internal Server Error' });
  });

  it('should handle ResponseError with 422 status', () => {
    const error = new ResponseError(422, 'No outlet available in your area');
    errorMiddleware(error, req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({ errors: 'No outlet available in your area' });
  });

  it('should handle ZodError with 400 status', () => {
    const zodError = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['name'],
        message: 'Expected string',
      } as any,
    ]);
    errorMiddleware(zodError as any, req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    // Returns sanitized issues array, not the full ZodError internals.
    expect(res.json).toHaveBeenCalledWith({
      errors: [{ path: ['name'], message: 'Expected string' }],
    });
  });

  it('should handle generic Error with 500 status', () => {
    const error = new Error('Unexpected error');
    errorMiddleware(error, req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(500);
    // Generic message prevents leaking DB internals or stack traces to the client.
    expect(res.json).toHaveBeenCalledWith({ errors: 'Internal server error' });
  });

  it('should handle unknown error type with 500 status', () => {
    const error = { message: 'Unknown error' };
    errorMiddleware(error as any, req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ errors: 'Internal server error' });
  });
});
