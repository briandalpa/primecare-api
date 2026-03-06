import { Response } from 'express';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode = 200,
): void => {
  res.status(statusCode).json({ data });
};
