import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Conversation,
  Scenario,
  Persona,
  Test,
  Run,
} from '../database/entities';
import { FlowModule } from '../flow/flow.module';
import { RunsModule } from '../runs/runs.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { SimulatedUserService } from './simulated-user.service';
import { ConversationExecutionService } from './conversation-execution.service';
import { ConversationRunService } from './conversation-run.service';
import { SummaryService } from './summary.service';
import { ConversationsController } from './conversations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Scenario, Persona, Test, Run]),
    FlowModule,
    RunsModule,
    WebhooksModule,
  ],
  controllers: [ConversationsController],
  providers: [
    SimulatedUserService,
    ConversationExecutionService,
    ConversationRunService,
    SummaryService,
  ],
  exports: [ConversationRunService],
})
export class ConversationModule {}
