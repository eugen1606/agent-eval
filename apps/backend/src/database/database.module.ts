import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AccessToken, QuestionSet, FlowConfig, User, ScheduledTest, Webhook, Test, Run } from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logLevel = configService.get<string>('LOG_LEVEL', 'info');
        // Only enable TypeORM logging for verbose or debug levels
        const enableTypeOrmLogging = ['verbose', 'debug'].includes(logLevel);

        return {
          type: 'postgres',
          url: configService.get<string>('DATABASE_URL'),
          entities: [AccessToken, QuestionSet, FlowConfig, User, ScheduledTest, Webhook, Test, Run],
          synchronize: configService.get<string>('NODE_ENV') !== 'production',
          logging: enableTypeOrmLogging,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
