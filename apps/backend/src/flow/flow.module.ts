import { Module } from '@nestjs/common';
import { FlowController } from './flow.controller';
import { FlowService } from './flow.service';
import { AccessTokensModule } from '../access-tokens/access-tokens.module';

@Module({
  imports: [AccessTokensModule],
  controllers: [FlowController],
  providers: [FlowService],
  exports: [FlowService],
})
export class FlowModule {}
