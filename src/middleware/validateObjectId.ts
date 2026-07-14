import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';

export function isValidObjectId(value: unknown): value is string {
  if (typeof value !== 'string' || !mongoose.Types.ObjectId.isValid(value)) return false;
  return String(new mongoose.Types.ObjectId(value)) === value.toLowerCase();
}

export function validateObjectIdParam(_req: Request, res: Response, next: NextFunction, value: string, name: string) {
  if (!isValidObjectId(value)) {
    res.status(400).json({ error: `Invalid ${name}` });
    return;
  }
  next();
}
