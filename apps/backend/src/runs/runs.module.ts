import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Run, Test } from '../database/entities';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { EvaluatorsModule } from '../evaluators/evaluators.module';
import { AccessTokensModule } from '../access-tokens/access-tokens.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Run, Test]),
    WebhooksModule,
    EvaluationModule,
    EvaluatorsModule,
    AccessTokensModule,
  ],
  controllers: [RunsController],
  providers: [RunsService],
  exports: [RunsService],
})
export class RunsModule {}
