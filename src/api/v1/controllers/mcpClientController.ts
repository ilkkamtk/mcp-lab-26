import { NextFunction, Request, Response } from 'express';
import CustomError from '@/classes/CustomError';
import { callMcpClient } from '@/mcp-client';

const postMcpClient = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      next(new CustomError('Prompt is required and must be a string', 400));
      return;
    }

    const result = await callMcpClient(prompt);

    res.json(result);
  } catch (error) {
    next(new CustomError((error as Error).message, 500));
  }
};

export { postMcpClient };
