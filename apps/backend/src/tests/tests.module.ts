import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Test, Tag } from '../database/entities';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';
import { FlowModule } from '../flow/flow.module';
import { RunsModule } from '../runs/runs.module';
import { QuestionsModule } from '../questions/questions.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { FlowConfigsModule } from '../flow-configs/flow-configs.module';
import { TagsModule } from '../tags/tags.module';
import { EvaluatorsModule } from '../evaluators/evaluators.module';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { AccessTokensModule } from '../access-tokens/access-tokens.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Test, Tag]),
    FlowModule,
    RunsModule,
    QuestionsModule,
    WebhooksModule,
    FlowConfigsModule,
    TagsModule,
    EvaluatorsModule,
    EvaluationModule,
    AccessTokensModule,
  ],
  controllers: [TestsController],
  providers: [TestsService],
  exports: [TestsService],
})
export class TestsModule {}
