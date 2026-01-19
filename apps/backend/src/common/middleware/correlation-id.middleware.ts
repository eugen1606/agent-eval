import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

export const CORRELATION_ID_HEADER = 'x-request-id';

/**
 * Async local storage for correlation ID.
 * Allows accessing the current request's correlation ID anywhere in the call stack.
 */
export const correlationStorage = new AsyncLocalStorage<string>();

/**
 * Get the current correlation ID from async local storage.
 * Returns undefined if not in a request context.
 */
export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore();
}

/**
 * Middleware that assigns a correlation ID to each request.
 * - Uses existing X-Request-ID header if provided (for distributed tracing)
 * - Generates a new UUID if not provided
 * - Stores in async local storage for access throughout the request lifecycle
 * - Adds correlation ID to response headers
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Use existing header or generate new ID
    const correlationId =
      (req.headers[CORRELATION_ID_HEADER] as string) || uuidv4();

    // Attach to request object for easy access
    (req as Request & { correlationId: string }).correlationId = correlationId;

    // Add to response headers
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    // Run the rest of the request in async local storage context
    correlationStorage.run(correlationId, () => {
      next();
    });
  }
}

/**
 * Express Request with correlation ID attached
 */
export interface RequestWithCorrelationId extends Request {
  correlationId: string;
}
