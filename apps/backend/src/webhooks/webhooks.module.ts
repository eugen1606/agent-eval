import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Webhook } from '../database/entities';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { VariableResolverService } from './variable-resolver.service';
import { WebhookRetryService } from './webhook-retry.service';

@Module({
  imports: [TypeOrmModule.forFeature([Webhook])],
  controllers: [WebhooksController],
  providers: [WebhooksService, VariableResolverService, WebhookRetryService],
  exports: [WebhooksService, WebhookRetryService],
})
export class WebhooksModule {}
