import { z } from 'zod';
import { Logger } from '@nestjs/common';

const logger = new Logger('ConfigValidation');

/**
 * Environment variables schema using Zod.
 * Validates required vars on startup (fail fast).
 */
export const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Encryption (must be exactly 64 hex characters)
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be exactly 64 hex characters')
    .regex(/^[a-fA-F0-9]+$/, 'ENCRYPTION_KEY must be valid hex'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

  // Redis (optional with default)
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Server
  PORT: z.coerce.number().int().positive().default(3001),

  // Admin user (optional - used for seeding)
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(6).optional(),

  // Database pool
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(20),
  DB_STATEMENT_TIMEOUT: z.coerce.number().int().min(1000).max(300000).default(30000),

  // Throttling
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
  THROTTLE_TTL: z.coerce.number().int().positive().default(60000),
  THROTTLE_DISABLED: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),

  // Logging
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug', 'verbose'])
    .default('info'),
  LOG_FORMAT: z.enum(['json', 'text']).default('text'),
  REQUEST_LOGGING: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),

  // Webhooks
  WEBHOOK_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),

  // CORS configuration
  CORS_ORIGINS: z
    .string()
    .optional()
    .default('http://localhost:4201,http://localhost:5173'),

  // SSRF Protection
  ALLOW_PRIVATE_URLS: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
  ALLOWED_URL_DOMAINS: z
    .string()
    .optional()
    .default('')
    .describe('Comma-separated list of allowed domains for outbound requests (e.g., api.example.com,flows.mycompany.internal)'),

});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validate function for NestJS ConfigModule.
 * Throws on validation failure (fail fast).
 */
export function validate(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');

    logger.error(`Environment validation failed:\n${errors}`);
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  logger.log('Environment variables validated successfully');
  return result.data;
}
