import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Standardized error response format
 */
export interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
}

/**
 * Global exception filter that provides consistent error responses
 * and centralized error logging.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, error } = this.getErrorDetails(exception);

    const errorResponse: ErrorResponse = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log the error with appropriate level
    this.logError(exception, errorResponse, request);

    response.status(statusCode).json(errorResponse);
  }

  private getErrorDetails(exception: unknown): {
    statusCode: number;
    message: string;
    error: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      // Handle validation errors (class-validator)
      if (typeof response === 'object' && response !== null) {
        const res = response as Record<string, unknown>;
        return {
          statusCode: status,
          message: Array.isArray(res.message)
            ? res.message.join(', ')
            : (res.message as string) || exception.message,
          error: (res.error as string) || HttpStatus[status] || 'Error',
        };
      }

      return {
        statusCode: status,
        message: exception.message,
        error: HttpStatus[status] || 'Error',
      };
    }

    // Handle unexpected errors
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }

  private logError(
    exception: unknown,
    errorResponse: ErrorResponse,
    request: Request,
  ): void {
    const { statusCode, message, path } = errorResponse;
    const method = request.method;

    // 5xx errors are logged as errors with stack trace
    if (statusCode >= 500) {
      this.logger.error(
        `${method} ${path} ${statusCode} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }
    // 4xx client errors are logged as warnings (no stack trace needed)
    else if (statusCode >= 400) {
      this.logger.warn(`${method} ${path} ${statusCode} - ${message}`);
    }
  }
}
