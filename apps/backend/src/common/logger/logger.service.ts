import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type LogFormat = 'json' | 'text';

export interface LogEntry {
  timestamp: string;
  level: string;
  context?: string;
  message: string;
  pid: number;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Custom logger service that supports both JSON and text output formats.
 * JSON format is ideal for log aggregation (ELK, CloudWatch, Datadog).
 */
@Injectable()
export class AppLoggerService implements LoggerService {
  private format: LogFormat = 'text';
  private context?: string;

  constructor(private configService?: ConfigService) {
    if (configService) {
      this.format = (configService.get<string>('LOG_FORMAT') as LogFormat) || 'text';
    }
  }

  setContext(context: string): void {
    this.context = context;
  }

  setFormat(format: LogFormat): void {
    this.format = format;
  }

  log(message: string, context?: string): void {
    this.writeLog('info', message, context);
  }

  error(message: string, trace?: string, context?: string): void {
    this.writeLog('error', message, context, { trace });
  }

  warn(message: string, context?: string): void {
    this.writeLog('warn', message, context);
  }

  debug(message: string, context?: string): void {
    this.writeLog('debug', message, context);
  }

  verbose(message: string, context?: string): void {
    this.writeLog('verbose', message, context);
  }

  private writeLog(
    level: string,
    message: string,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    const ctx = context || this.context;

    if (this.format === 'json') {
      this.writeJson(level, message, ctx, extra);
    } else {
      this.writeText(level, message, ctx, extra);
    }
  }

  private writeJson(
    level: string,
    message: string,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      pid: process.pid,
      ...extra,
    };

    // Remove undefined values
    Object.keys(entry).forEach((key) => {
      if (entry[key] === undefined) {
        delete entry[key];
      }
    });

    const output = JSON.stringify(entry);

    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  private writeText(
    level: string,
    message: string,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    const timestamp = new Date().toLocaleString();
    const pid = process.pid;
    const levelUpper = level.toUpperCase().padEnd(7);
    const contextStr = context ? `[${context}] ` : '';
    const traceStr = extra?.trace ? `\n${extra.trace}` : '';

    const output = `[Nest] ${pid}  - ${timestamp}  ${levelUpper} ${contextStr}${message}${traceStr}`;

    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }
}

/**
 * Factory function to create logger for NestFactory.create()
 * before DI is available.
 */
export function createLogger(format?: LogFormat): AppLoggerService {
  const logger = new AppLoggerService();
  if (format) {
    logger.setFormat(format);
  }
  return logger;
}
