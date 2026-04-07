import { Router } from 'express';
import type { Request, Response, Router as IRouter } from 'express';

const VERSION = '0.1.0';

export const healthRouter: IRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: VERSION,
    },
  });
});
