import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessToken, Test } from '../database/entities';
import { AccessTokensController } from './access-tokens.controller';
import { AccessTokensService } from './access-tokens.service';
import { EncryptionService } from '../config/encryption.service';

@Module({
  imports: [TypeOrmModule.forFeature([AccessToken, Test])],
  controllers: [AccessTokensController],
  providers: [AccessTokensService, EncryptionService],
  exports: [AccessTokensService],
})
export class AccessTokensModule {}
