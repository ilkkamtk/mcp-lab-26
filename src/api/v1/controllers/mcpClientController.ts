import { NextFunction, Request, Response } from 'express';
import CustomError from '@/classes/CustomError';
import { runMcpClient } from '@/mcp-client';

const postMcpClient = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const prompt = req.body?.prompt;

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return next(new CustomError('Invalid request body', 400));
    }

    const { answer, toolCalls } = await runMcpClient(prompt);
    res.json({ answer, toolCalls });
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'env incomplete') {
      return next(new CustomError('env incomplete', 500));
    }
    if (message.toLowerCase().includes('fetch failed')) {
      return next(new CustomError('OpenAI proxy unavailable', 502));
    }
    next(new CustomError(message, 500));
  }
};

export { postMcpClient };
