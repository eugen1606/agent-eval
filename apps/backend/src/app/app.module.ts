import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { FlowModule } from '../flow/flow.module';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AccessTokensModule } from '../access-tokens/access-tokens.module';
import { QuestionsModule } from '../questions/questions.module';
import { EvaluationsModule } from '../evaluations/evaluations.module';
import { FlowConfigsModule } from '../flow-configs/flow-configs.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    FlowModule,
    EvaluationModule,
    SessionsModule,
    AccessTokensModule,
    QuestionsModule,
    EvaluationsModule,
    FlowConfigsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
