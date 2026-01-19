import { Logger, LogLevel, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app/app.module';
import { GlobalExceptionFilter } from './common/filters';
import { createLogger, LogFormat } from './common/logger';
import { LoggingInterceptor } from './common/interceptors';
import { MetricsService } from './metrics';

function getLogLevels(): LogLevel[] {
  const logLevel = process.env.LOG_LEVEL || 'info';

  const levels: Record<string, LogLevel[]> = {
    error: ['error'],
    warn: ['error', 'warn'],
    info: ['error', 'warn', 'log'],
    debug: ['error', 'warn', 'log', 'debug'],
    verbose: ['error', 'warn', 'log', 'debug', 'verbose'],
  };

  return levels[logLevel] || levels.info;
}

async function bootstrap() {
  // Determine log format from env (before DI is available)
  const logFormat = (process.env.LOG_FORMAT as LogFormat) || 'text';
  const customLogger = createLogger(logFormat);

  const app = await NestFactory.create(AppModule, {
    logger: logFormat === 'json' ? customLogger : getLogLevels(),
  });

  // Enable graceful shutdown hooks (OnModuleDestroy, OnApplicationShutdown)
  app.enableShutdownHooks();

  // Cookie parser middleware for cookie-based authentication
  app.use(cookieParser());

  // Security headers (helmet.js) with explicit configuration
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Needed for inline styles
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
      crossOriginEmbedderPolicy: false, // May need to be false for SSE
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin for API
    })
  );

  // Global exception filter for consistent error responses
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global validation pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: false, // Don't error on extra properties, just strip them
      transform: true, // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Convert types based on TS metadata
      },
    }),
  );

  // Enable CORS for frontend with configurable origins
  const configService = app.get(ConfigService);
  const corsOriginsEnv = configService.get<string>('CORS_ORIGINS');
  const corsOrigins = corsOriginsEnv
    ? corsOriginsEnv.split(',').map((s) => s.trim()).filter(Boolean)
    : ['http://localhost:4201', 'http://localhost:5173'];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, server-to-server, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Request-ID', 'X-CSRF-Token'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
    credentials: true,
  });

  // Request logging interceptor with metrics (uses services from DI)
  const metricsService = app.get(MetricsService);
  app.useGlobalInterceptors(new LoggingInterceptor(configService, metricsService));

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3001;
  await app.listen(port);
  Logger.log(
    `Application is running on: http://localhost:${port}/${globalPrefix}`,
  );

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    Logger.log(`Received ${signal}, starting graceful shutdown...`);

    // Give time for load balancers to stop sending traffic
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      await app.close();
      Logger.log('Application shut down gracefully');
      process.exit(0);
    } catch (error) {
      Logger.error(`Error during shutdown: ${error}`);
      process.exit(1);
    }
  };

  // Handle termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
