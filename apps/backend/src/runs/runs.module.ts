import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Run } from '../database/entities';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';

@Module({
  imports: [TypeOrmModule.forFeature([Run])],
  controllers: [RunsController],
  providers: [RunsService],
  exports: [RunsService],
})
export class RunsModule {}
