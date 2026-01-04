import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import {
  AccessToken,
  Evaluation,
  QuestionSet,
  FlowConfig,
} from './entities';
import { MigrationService } from './migration.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      AccessToken,
      Evaluation,
      QuestionSet,
      FlowConfig,
    ]),
  ],
  providers: [MigrationService],
  exports: [MigrationService],
})
export class MigrationModule {}
