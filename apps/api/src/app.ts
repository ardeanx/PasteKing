import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from './logger';
import { requestIdMiddleware, errorMiddleware, notFoundHandler, rateLimiter } from './middleware';
import { healthRouter } from './modules/health';
import { v1Router } from './routes/v1';
import { handleStripeWebhook } from './modules/billing';

export function createApp(): express.Express {
  const app = express();

  // Security
  app.use(helmet());
  app.use(
    cors({
      origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
      credentials: true,
    }),
  );

  // Stripe webhook must receive raw body (before JSON parsing)
  app.post('/v1/billing/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

  // Admin settings needs a higher limit for base64-encoded logo/favicon uploads
  app.use('/v1/admin/settings', express.json({ limit: '10mb' }));

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.text({ limit: '1mb', type: 'text/plain' }));

  // Request ID
  app.use(requestIdMiddleware);

  // Logging
  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({
        requestId: (req as express.Request).requestId,
      }),
    }),
  );

  // Rate limiting
  app.use(rateLimiter);

  // Root health check
  app.use('/', healthRouter);

  // API v1
  app.use('/v1', v1Router);

  // Not found handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorMiddleware);

  return app;
}
