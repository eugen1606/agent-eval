import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FlowModule } from '../flow/flow.module';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [FlowModule, EvaluationModule, SessionsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
