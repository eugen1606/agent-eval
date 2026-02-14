import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Test, Tag, Scenario, Persona } from '../database/entities';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';
import { ScenariosService } from './scenarios.service';
import { FlowModule } from '../flow/flow.module';
import { RunsModule } from '../runs/runs.module';
import { QuestionsModule } from '../questions/questions.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { FlowConfigsModule } from '../flow-configs/flow-configs.module';
import { TagsModule } from '../tags/tags.module';
import { EvaluatorsModule } from '../evaluators/evaluators.module';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { AccessTokensModule } from '../access-tokens/access-tokens.module';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Test, Tag, Scenario, Persona]),
    FlowModule,
    RunsModule,
    QuestionsModule,
    WebhooksModule,
    FlowConfigsModule,
    TagsModule,
    EvaluatorsModule,
    EvaluationModule,
    AccessTokensModule,
    ConversationModule,
  ],
  controllers: [TestsController],
  providers: [TestsService, ScenariosService],
  exports: [TestsService, ScenariosService],
})
export class TestsModule {}
