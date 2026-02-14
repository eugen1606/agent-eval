import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  AccessToken,
  QuestionSet,
  FlowConfig,
  User,
  ScheduledTest,
  Webhook,
  Test,
  Run,
  Tag,
  Evaluator,
  Persona,
  Scenario,
  Conversation,
} from './entities';
import * as migrations from './migrations';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logLevel = configService.get<string>('LOG_LEVEL', 'info');
        // Only enable TypeORM logging for verbose or debug levels
        const enableTypeOrmLogging = ['verbose', 'debug'].includes(logLevel);

        // Connection pool configuration
        const poolSize = configService.get<number>('DB_POOL_SIZE', 20);
        const statementTimeout = configService.get<number>(
          'DB_STATEMENT_TIMEOUT',
          30000,
        );

        return {
          type: 'postgres',
          url: configService.get<string>('DATABASE_URL'),
          entities: [
            AccessToken,
            QuestionSet,
            FlowConfig,
            User,
            ScheduledTest,
            Webhook,
            Test,
            Run,
            Tag,
            Evaluator,
            Persona,
            Scenario,
            Conversation,
          ],
          migrations: Object.values(migrations),
          migrationsRun: true,
          migrationsTableName: 'typeorm_migrations',
          logging: enableTypeOrmLogging,
          // Connection pool settings
          extra: {
            // Maximum number of connections in the pool
            max: poolSize,
            // Statement timeout in milliseconds (prevents long-running queries)
            statement_timeout: statementTimeout,
            // Idle timeout - close connections idle longer than this (10 minutes)
            idleTimeoutMillis: 600000,
            // Connection timeout - fail if can't connect within this time (10 seconds)
            connectionTimeoutMillis: 10000,
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
