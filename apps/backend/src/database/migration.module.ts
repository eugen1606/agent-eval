import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import {
  AccessToken,
  QuestionSet,
  FlowConfig,
} from './entities';
import { MigrationService } from './migration.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      AccessToken,
      QuestionSet,
      FlowConfig,
    ]),
  ],
  providers: [MigrationService],
  exports: [MigrationService],
})
export class MigrationModule {}
