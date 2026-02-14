import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Test,
  QuestionSet,
  FlowConfig,
  Tag,
  Webhook,
  Run,
  Persona,
  Conversation,
} from '../database/entities';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Test, QuestionSet, FlowConfig, Tag, Webhook, Run, Persona, Conversation]),
  ],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
