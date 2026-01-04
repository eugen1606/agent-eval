import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook, WebhookEvent } from '../database/entities';

export interface CreateWebhookDto {
  name: string;
  url: string;
  description?: string;
  events: WebhookEvent[];
  secret?: string;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(Webhook)
    private webhookRepository: Repository<Webhook>,
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

  async update(id: string, dto: Partial<CreateWebhookDto>, userId: string): Promise<Webhook> {
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

  async triggerWebhooks(userId: string, event: WebhookEvent, data: Record<string, unknown>): Promise<void> {
    const webhooks = await this.webhookRepository.find({
      where: { userId, enabled: true },
    });

    const matchingWebhooks = webhooks.filter((w) => w.events.includes(event));

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    for (const webhook of matchingWebhooks) {
      this.sendWebhook(webhook, payload).catch((error) => {
        this.logger.error(`Failed to send webhook ${webhook.id}: ${error.message}`);
      });
    }
  }

  private async sendWebhook(webhook: Webhook, payload: WebhookPayload): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (webhook.secret) {
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      headers['X-Webhook-Signature'] = signature;
    }

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.warn(`Webhook ${webhook.id} returned status ${response.status}`);
      } else {
        this.logger.log(`Webhook ${webhook.id} delivered successfully`);
      }
    } catch (error) {
      this.logger.error(`Webhook ${webhook.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
