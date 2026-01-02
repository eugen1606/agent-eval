import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduledEvaluation } from '../database/entities/scheduled-evaluation.entity';
import { ScheduledEvaluationsController } from './scheduled-evaluations.controller';
import { ScheduledEvaluationsService } from './scheduled-evaluations.service';
import { SchedulerService } from './scheduler.service';
import { FlowModule } from '../flow/flow.module';
import { QuestionsModule } from '../questions/questions.module';
import { FlowConfigsModule } from '../flow-configs/flow-configs.module';
import { EvaluationsModule } from '../evaluations/evaluations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduledEvaluation]),
    ScheduleModule.forRoot(),
    FlowModule,
    QuestionsModule,
    FlowConfigsModule,
    EvaluationsModule,
  ],
  controllers: [ScheduledEvaluationsController],
  providers: [ScheduledEvaluationsService, SchedulerService],
  exports: [ScheduledEvaluationsService],
})
export class ScheduledEvaluationsModule {}
