import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Test } from '../database/entities';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';
import { FlowModule } from '../flow/flow.module';
import { RunsModule } from '../runs/runs.module';
import { QuestionsModule } from '../questions/questions.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Test]),
    FlowModule,
    RunsModule,
    QuestionsModule,
    WebhooksModule,
  ],
  controllers: [TestsController],
  providers: [TestsService],
  exports: [TestsService],
})
export class TestsModule {}
