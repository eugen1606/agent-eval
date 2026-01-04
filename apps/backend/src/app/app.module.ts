import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { MigrationModule } from '../database/migration.module';
import { AuthModule } from '../auth/auth.module';
import { FlowModule } from '../flow/flow.module';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { AccessTokensModule } from '../access-tokens/access-tokens.module';
import { QuestionsModule } from '../questions/questions.module';
import { EvaluationsModule } from '../evaluations/evaluations.module';
import { FlowConfigsModule } from '../flow-configs/flow-configs.module';
import { ScheduledEvaluationsModule } from '../scheduled-evaluations/scheduled-evaluations.module';
import { HealthModule } from '../health/health.module';
import { AppThrottlerModule, CustomThrottlerGuard } from '../throttler';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    AuthModule,
    MigrationModule,
    FlowModule,
    EvaluationModule,
    AccessTokensModule,
    QuestionsModule,
    EvaluationsModule,
    FlowConfigsModule,
    ScheduledEvaluationsModule,
    HealthModule,
    AppThrottlerModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
