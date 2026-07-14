import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const isDuplicateKey = (err as Error & { code?: number }).code === 11000;
  const isClientDataError = err instanceof mongoose.Error.CastError || err instanceof mongoose.Error.ValidationError;
  const statusCode = err instanceof AppError ? err.statusCode : isDuplicateKey ? 409 : isClientDataError ? 400 : 500;
  const message = err instanceof mongoose.Error.CastError
    ? `Invalid ${err.path}`
    : isDuplicateKey
      ? 'A record with this value already exists'
      : err.message || 'Internal server error';

  const log = statusCode >= 500 ? console.error : console.warn;
  log(`[${new Date().toISOString()}] ${statusCode >= 500 ? 'Error' : 'Request rejected'}:`, {
    statusCode,
    message,
    ...(statusCode >= 500 ? { stack: err.stack } : {}),
    path: req.path,
    method: req.method,
  });

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
