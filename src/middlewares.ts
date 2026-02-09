import { NextFunction, Request, Response } from 'express';
import { ErrorResponse } from '@/types/LocalTypes';
import CustomError from './classes/CustomError';
import fs from 'fs';
import fetchData from './utils/fetchData';

const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new CustomError(`🔍 - Not Found - ${req.originalUrl}`, 404);
  next(error);
};

const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response<ErrorResponse>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) => {
  // console.log(err);
  const statusCode = err.status && err.status >= 400 ? err.status : 500;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
  });
};

const transcribeAudio = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.file) {
    return next();
  }

  try {
    const buffer = fs.readFileSync(req.file.path);
    const blob = new Blob([buffer], { type: req.file.mimetype });
    const form = new FormData();
    form.append('file', blob, req.file.originalname);
    form.append('model', 'whisper-1');

    const data = await fetchData<{ text: string }>(
      `${process.env.OPENAI_PROXY_URL}/v1/audio/transcriptions`,
      {
        method: 'POST',
        body: form,
      },
    );
    req.body.prompt = data.text;

    // Clean up
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Failed to delete file:', err);
    });

    next();
  } catch (error) {
    // Clean up on error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Failed to delete file on error:', err);
      });
    }
    next(error);
  }
};

export { notFound, errorHandler, transcribeAudio };
