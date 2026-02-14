import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CorrelationIdMiddleware } from '../common/middleware';
import { CommonModule } from '../common/common.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { FlowModule } from '../flow/flow.module';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { AccessTokensModule } from '../access-tokens/access-tokens.module';
import { QuestionsModule } from '../questions/questions.module';
import { FlowConfigsModule } from '../flow-configs/flow-configs.module';
import { ScheduledTestsModule } from '../scheduled-tests/scheduled-tests.module';
import { HealthModule } from '../health/health.module';
import { AppThrottlerModule, CustomThrottlerGuard } from '../throttler';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { TestsModule } from '../tests/tests.module';
import { RunsModule } from '../runs/runs.module';
import { CleanupModule } from '../cleanup/cleanup.module';
import { MetricsModule } from '../metrics';
import { TagsModule } from '../tags/tags.module';
import { ExportModule } from '../export/export.module';
import { EvaluatorsModule } from '../evaluators/evaluators.module';
import { PersonasModule } from '../personas/personas.module';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
  imports: [
    AppConfigModule,
    CommonModule,
    DatabaseModule,
    AuthModule,
    FlowModule,
    EvaluationModule,
    AccessTokensModule,
    QuestionsModule,
    FlowConfigsModule,
    ScheduledTestsModule,
    HealthModule,
    AppThrottlerModule,
    WebhooksModule,
    TestsModule,
    RunsModule,
    CleanupModule,
    MetricsModule,
    TagsModule,
    ExportModule,
    EvaluatorsModule,
    PersonasModule,
    ConversationModule,
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
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply correlation ID middleware to all routes
    consumer.apply(CorrelationIdMiddleware).forRoutes('*path');
  }
}
