import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduledTest } from '../database/entities/scheduled-test.entity';
import { Test } from '../database/entities/test.entity';
import { ScheduledTestsController } from './scheduled-tests.controller';
import { ScheduledTestsService } from './scheduled-tests.service';
import { SchedulerService } from './scheduler.service';
import { FlowModule } from '../flow/flow.module';
import { QuestionsModule } from '../questions/questions.module';
import { TestsModule } from '../tests/tests.module';
import { RunsModule } from '../runs/runs.module';
import { ConversationModule } from '../conversation/conversation.module';
import { AccessTokensModule } from '../access-tokens/access-tokens.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduledTest, Test]),
    FlowModule,
    QuestionsModule,
    forwardRef(() => TestsModule),
    forwardRef(() => RunsModule),
    ConversationModule,
    AccessTokensModule,
  ],
  controllers: [ScheduledTestsController],
  providers: [ScheduledTestsService, SchedulerService],
  exports: [ScheduledTestsService],
})
export class ScheduledTestsModule {}
