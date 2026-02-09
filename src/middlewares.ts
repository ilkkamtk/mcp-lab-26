import { NextFunction, Request, Response } from 'express';
import { ErrorResponse } from '@/types/LocalTypes';
import CustomError from './classes/CustomError';
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
    const blob = new Blob([new Uint8Array(req.file.buffer)], {
      type: req.file.mimetype,
    });
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

    // No file cleanup needed for memory storage
    next();
  } catch (error) {
    // No cleanup needed for memory storage
    next(error);
  }
};

export { notFound, errorHandler, transcribeAudio };
