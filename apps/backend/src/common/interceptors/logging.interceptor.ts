import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { getCorrelationId } from '../middleware/correlation-id.middleware';
import { MetricsService } from '../../metrics';

export interface RequestLogEntry {
  timestamp: string;
  requestId?: string;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  contentLength?: number;
  userAgent?: string;
  ip?: string;
  userId?: string;
}

/**
 * Interceptor that logs all HTTP requests with timing information.
 * Logs in structured format for easy parsing by log aggregation tools.
 * Also records Prometheus metrics when MetricsService is provided.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  private readonly enabled: boolean;
  private readonly logFormat: string;

  constructor(
    private configService: ConfigService,
    private metricsService?: MetricsService,
  ) {
    this.enabled = configService.get<string>('REQUEST_LOGGING', 'true') === 'true';
    this.logFormat = configService.get<string>('LOG_FORMAT', 'text');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request & { correlationId?: string; user?: { userId?: string } }>();
    const response = ctx.getResponse<Response>();

    const startTime = Date.now();
    const { method, originalUrl, ip } = request;
    const userAgent = request.get('user-agent');
    const correlationId = request.correlationId || getCorrelationId();

    // Track active connections
    this.metricsService?.incrementConnections();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;

          // Record metrics
          this.metricsService?.recordHttpRequest(method, originalUrl, response.statusCode, duration);
          this.metricsService?.decrementConnections();

          // Log request if enabled
          if (this.enabled) {
            this.logRequest(
              method,
              originalUrl,
              response.statusCode,
              duration,
              correlationId,
              userAgent,
              ip,
              request.user?.userId,
              response.get('content-length'),
            );
          }
        },
        error: (error) => {
          const statusCode = error.status || error.statusCode || 500;
          const duration = Date.now() - startTime;

          // Record metrics
          this.metricsService?.recordHttpRequest(method, originalUrl, statusCode, duration);
          this.metricsService?.decrementConnections();

          // Log request if enabled
          if (this.enabled) {
            this.logRequest(
              method,
              originalUrl,
              statusCode,
              duration,
              correlationId,
              userAgent,
              ip,
              request.user?.userId,
              undefined,
              error.message,
            );
          }
        },
      }),
    );
  }

  private logRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    requestId?: string,
    userAgent?: string,
    ip?: string,
    userId?: string,
    contentLength?: string,
    error?: string,
  ): void {
    if (this.logFormat === 'json') {
      this.logJson(method, path, statusCode, duration, requestId, userAgent, ip, userId, contentLength, error);
    } else {
      this.logText(method, path, statusCode, duration, requestId);
    }
  }

  private logJson(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    requestId?: string,
    userAgent?: string,
    ip?: string,
    userId?: string,
    contentLength?: string,
    error?: string,
  ): void {
    const entry: RequestLogEntry & { error?: string } = {
      timestamp: new Date().toISOString(),
      requestId,
      method,
      path,
      statusCode,
      duration,
      contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
      userAgent,
      ip,
      userId,
    };

    if (error) {
      entry.error = error;
    }

    // Remove undefined values
    Object.keys(entry).forEach((key) => {
      if (entry[key as keyof typeof entry] === undefined) {
        delete entry[key as keyof typeof entry];
      }
    });

    if (statusCode >= 500) {
      this.logger.error(JSON.stringify(entry));
    } else if (statusCode >= 400) {
      this.logger.warn(JSON.stringify(entry));
    } else {
      this.logger.log(JSON.stringify(entry));
    }
  }

  private logText(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    requestId?: string,
  ): void {
    const reqIdStr = requestId ? `[${requestId.substring(0, 8)}] ` : '';
    const message = `${reqIdStr}${method} ${path} ${statusCode} ${duration}ms`;

    if (statusCode >= 500) {
      this.logger.error(message);
    } else if (statusCode >= 400) {
      this.logger.warn(message);
    } else {
      this.logger.log(message);
    }
  }
}
