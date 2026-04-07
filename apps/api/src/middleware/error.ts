import type { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { Prisma } from '@pasteking/db';
import { logger } from '../logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(404, 'NOT_FOUND', `${resource} with id '${id}' not found`);
  }
}

function isZodError(err: unknown): err is ZodError {
  return err instanceof ZodError || (err instanceof Error && err.name === 'ZodError');
}

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Handle Express body-parser payload too large
  if ('type' in err && (err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body exceeds the maximum allowed size (1 MB)',
      },
    });
    return;
  }

  if (err instanceof AppError) {
    const response: Record<string, unknown> = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    };

    // Attach quota detail if present
    if (err.code === 'QUOTA_EXCEEDED' && 'quotaDetail' in err) {
      (response.error as Record<string, unknown>).quotaDetail = (
        err as AppError & { quotaDetail: unknown }
      ).quotaDetail;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  if (isZodError(err)) {
    const tree = z.treeifyError(err) as {
      errors: string[];
      properties?: Record<string, { errors: string[] } | undefined>;
    };
    const details: Record<string, string[]> = {};
    if (tree.properties) {
      for (const [key, sub] of Object.entries(tree.properties)) {
        if (sub && sub.errors.length > 0) {
          details[key] = sub.errors;
        }
      }
    }
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details,
      },
    });
    return;
  }

  // Handle Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[])?.join(', ') ?? 'field';
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: `A record with that ${target} already exists`,
        },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested record was not found',
        },
      });
      return;
    }
  }

  logger.error({ err, requestId: req.requestId }, 'Unhandled error');

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal server error occurred',
    },
  });
}
