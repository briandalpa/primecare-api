import { ResponseError } from '@/error/response-error';

describe('ResponseError', () => {
  it('should create a ResponseError with 400 status', () => {
    const error = new ResponseError(400, 'Bad Request');
    expect(error.status).toBe(400);
    expect(error.message).toBe('Bad Request');
  });

  it('should create a ResponseError with 401 status', () => {
    const error = new ResponseError(401, 'Unauthorized');
    expect(error.status).toBe(401);
    expect(error.message).toBe('Unauthorized');
  });

  it('should create a ResponseError with 403 status', () => {
    const error = new ResponseError(403, 'Forbidden');
    expect(error.status).toBe(403);
    expect(error.message).toBe('Forbidden');
  });

  it('should create a ResponseError with 404 status', () => {
    const error = new ResponseError(404, 'Not Found');
    expect(error.status).toBe(404);
    expect(error.message).toBe('Not Found');
  });

  it('should create a ResponseError with 409 status', () => {
    const error = new ResponseError(409, 'Conflict');
    expect(error.status).toBe(409);
    expect(error.message).toBe('Conflict');
  });

  it('should create a ResponseError with 500 status', () => {
    const error = new ResponseError(500, 'Internal Server Error');
    expect(error.status).toBe(500);
    expect(error.message).toBe('Internal Server Error');
  });

  it('should be an instance of Error', () => {
    const error = new ResponseError(400, 'Bad Request');
    expect(error instanceof Error).toBe(true);
  });

  it('should have message property from Error', () => {
    const error = new ResponseError(404, 'Not Found');
    expect(error.message).toBe('Not Found');
  });

  it('should be throwable and catchable as Error', () => {
    const error = new ResponseError(500, 'Internal Server Error');
    expect(() => {
      throw error;
    }).toThrow(error);
  });

  it('should be catchable as ResponseError', () => {
    const error = new ResponseError(500, 'Internal Server Error');
    expect(() => {
      throw error;
    }).toThrow(ResponseError);
  });

  it('should preserve status and message when thrown and caught', () => {
    const error = new ResponseError(403, 'Access Denied');
    try {
      throw error;
    } catch (e) {
      expect(e).toBeInstanceOf(ResponseError);
      expect((e as ResponseError).status).toBe(403);
      expect((e as ResponseError).message).toBe('Access Denied');
    }
  });

  it('should accept custom error message', () => {
    const customMessage = 'User not found in database';
    const error = new ResponseError(404, customMessage);
    expect(error.message).toBe(customMessage);
  });

  it('should accept various status codes', () => {
    const statusCodes = [200, 201, 204, 301, 302, 400, 401, 403, 404, 409, 422, 500, 502, 503];
    statusCodes.forEach((status) => {
      const error = new ResponseError(status, 'Test message');
      expect(error.status).toBe(status);
    });
  });

  it('should maintain message with special characters', () => {
    const message = 'Error: Invalid input! @#$%^&*()';
    const error = new ResponseError(400, message);
    expect(error.message).toBe(message);
  });

  it('should maintain message with newlines', () => {
    const message = 'Error line 1\nError line 2';
    const error = new ResponseError(500, message);
    expect(error.message).toBe(message);
  });

  it('should have stack trace', () => {
    const error = new ResponseError(500, 'Internal Server Error');
    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe('string');
  });

  it('should work with JSON.stringify for logging', () => {
    const error = new ResponseError(404, 'Not Found');
    const json = JSON.stringify({ status: error.status, message: error.message });
    expect(json).toContain('404');
    expect(json).toContain('Not Found');
  });
});
