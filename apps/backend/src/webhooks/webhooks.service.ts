import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook, WebhookEvent, WebhookMethod } from '../database/entities';
import {
  VariableResolverService,
  WebhookContext,
} from './variable-resolver.service';

export interface CreateWebhookDto {
  name: string;
  url: string;
  description?: string;
  events: WebhookEvent[];
  secret?: string;
  method: WebhookMethod;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  bodyTemplate: Record<string, unknown>;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(Webhook)
    private webhookRepository: Repository<Webhook>,
    private variableResolver: VariableResolverService,
  ) {}

  async create(dto: CreateWebhookDto, userId: string): Promise<Webhook> {
    const webhook = this.webhookRepository.create({
      ...dto,
      userId,
    });
    return this.webhookRepository.save(webhook);
  }

  async findAll(userId: string): Promise<Webhook[]> {
    return this.webhookRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Webhook> {
    const webhook = await this.webhookRepository.findOne({
      where: { id, userId },
    });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    return webhook;
  }

  async update(
    id: string,
    dto: Partial<CreateWebhookDto>,
    userId: string,
  ): Promise<Webhook> {
    const webhook = await this.findOne(id, userId);
    Object.assign(webhook, dto);
    return this.webhookRepository.save(webhook);
  }

  async delete(id: string, userId: string): Promise<void> {
    const webhook = await this.findOne(id, userId);
    await this.webhookRepository.remove(webhook);
  }

  async toggleEnabled(id: string, userId: string): Promise<Webhook> {
    const webhook = await this.findOne(id, userId);
    webhook.enabled = !webhook.enabled;
    return this.webhookRepository.save(webhook);
  }

  async triggerWebhooks(
    userId: string,
    event: WebhookEvent,
    context: Omit<WebhookContext, 'event' | 'timestamp'>,
  ): Promise<void> {
    const webhooks = await this.webhookRepository.find({
      where: { userId, enabled: true },
    });

    const matchingWebhooks = webhooks.filter((w) => w.events.includes(event));

    const fullContext: WebhookContext = {
      ...context,
      event,
      timestamp: new Date().toISOString(),
    };

    for (const webhook of matchingWebhooks) {
      this.sendWebhook(webhook, fullContext).catch((error) => {
        this.logger.error(
          `Failed to send webhook ${webhook.id}: ${error.message}`,
        );
      });
    }
  }

  private async sendWebhook(
    webhook: Webhook,
    context: WebhookContext,
  ): Promise<void> {
    // Resolve body template with variables
    const resolvedBody = this.variableResolver.resolveObject(
      webhook.bodyTemplate || {},
      context,
    );

    // Resolve custom headers with variables
    const resolvedHeaders = this.variableResolver.resolveHeaders(
      webhook.headers,
      context,
    );

    // Resolve query params with variables
    const resolvedQueryParams = this.variableResolver.resolveQueryParams(
      webhook.queryParams,
      context,
    );

    // Build final URL with query params
    const finalUrl = this.variableResolver.buildUrlWithParams(
      webhook.url,
      resolvedQueryParams,
    );

    // Build headers (always include Content-Type)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...resolvedHeaders,
    };

    // Add HMAC signature if secret is configured
    if (webhook.secret) {
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(resolvedBody))
        .digest('hex');
      headers['X-Webhook-Signature'] = signature;
    }

    console.log(
      JSON.stringify(
        {
          method: webhook.method || 'POST',
          headers,
          body: resolvedBody,
        },
        null,
        2,
      ),
    );

    try {
      this.logger.debug(`Sending webhook to: ${finalUrl}`);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(finalUrl, {
        method: webhook.method || 'POST',
        headers,
        body: JSON.stringify(resolvedBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const responseText = await response.text().catch(() => '');
        this.logger.warn(
          `Webhook ${webhook.id} returned status ${response.status}: ${responseText}`,
        );
      } else {
        this.logger.log(`Webhook ${webhook.id} delivered successfully`);
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          this.logger.error(`Webhook ${webhook.id} timed out after 30 seconds`);
        } else {
          // Get the underlying cause if available (Node.js fetch wraps errors)
          const cause = (error as Error & { cause?: Error }).cause;
          const causeMessage = cause ? `: ${cause.message}` : '';
          const causeCode = (cause as Error & { code?: string })?.code;
          const codeMessage = causeCode ? ` (${causeCode})` : '';

          this.logger.error(
            `Webhook ${webhook.id} failed: ${error.message}${causeMessage}${codeMessage}`,
          );
          if (cause?.stack) {
            this.logger.debug(`Cause stack: ${cause.stack}`);
          }
        }
      } else {
        this.logger.error(`Webhook ${webhook.id} failed: Unknown error`);
      }
    }
  }

  getAvailableVariables() {
    return this.variableResolver.getAvailableVariables();
  }
}
