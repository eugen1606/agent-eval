import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlowConfig } from '../database/entities';
import { FlowConfigsController } from './flow-configs.controller';
import { FlowConfigsService } from './flow-configs.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([FlowConfig]), CommonModule],
  controllers: [FlowConfigsController],
  providers: [FlowConfigsService],
  exports: [FlowConfigsService],
})
export class FlowConfigsModule {}
