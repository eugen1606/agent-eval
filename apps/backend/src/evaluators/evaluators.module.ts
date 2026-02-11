import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Evaluator, AccessToken } from '../database/entities';
import { EvaluatorsController } from './evaluators.controller';
import { EvaluatorsService } from './evaluators.service';

@Module({
  imports: [TypeOrmModule.forFeature([Evaluator, AccessToken])],
  controllers: [EvaluatorsController],
  providers: [EvaluatorsService],
  exports: [EvaluatorsService],
})
export class EvaluatorsModule {}
