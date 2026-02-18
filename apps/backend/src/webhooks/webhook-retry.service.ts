import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import { Webhook, WebhookMethod } from '../database/entities';

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  url: string;
  method: WebhookMethod;
  headers: Record<string, string>;
  body: string;
  attempt: number;
  maxRetries: number;
  nextRetryAt: number;
  createdAt: number;
  lastError?: string;
}

/**
 * Webhook retry service using Redis as a queue.
 * Failed webhooks are retried with exponential backoff.
 */
@Injectable()
export class WebhookRetryService implements OnModuleDestroy {
  private readonly logger = new Logger(WebhookRetryService.name);
  private redis: Redis;
  private isConnected = false;
  private readonly maxRetries: number;

  // Redis keys
  private readonly RETRY_QUEUE_KEY = 'webhook:retry:queue';
  private readonly DELIVERY_PREFIX = 'webhook:delivery:';

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.maxRetries = this.configService.get<number>('WEBHOOK_MAX_RETRIES', 3);

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        if (times > 3) {
          this.logger.warn('Redis connection failed after 3 retries, webhook retries disabled');
          return null;
        }
        return Math.min(times * 100, 1000);
      },
    });

    this.redis.on('connect', () => {
      this.isConnected = true;
      this.logger.log('Connected to Redis for webhook retries');
    });

    this.redis.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      this.logger.warn('Redis connection closed');
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  /**
   * Calculate next retry time using exponential backoff.
   * Base delay: 10 seconds, doubles each attempt.
   * Max delay: 1 hour.
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = 10 * 1000; // 10 seconds
    const maxDelay = 60 * 60 * 1000; // 1 hour
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    // Add jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.floor(delay + jitter);
  }

  /**
   * Queue a failed webhook for retry.
   */
  async queueForRetry(
    webhook: Webhook,
    resolvedUrl: string,
    resolvedHeaders: Record<string, string>,
    resolvedBody: Record<string, unknown>,
    error: string
  ): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, cannot queue webhook for retry');
      return;
    }

    const deliveryId = `${webhook.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = Date.now();
    const backoff = this.calculateBackoff(1);

    const delivery: WebhookDelivery = {
      id: deliveryId,
      webhookId: webhook.id,
      url: resolvedUrl,
      method: webhook.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...resolvedHeaders,
      },
      body: JSON.stringify(resolvedBody),
      attempt: 1,
      maxRetries: this.maxRetries,
      nextRetryAt: now + backoff,
      createdAt: now,
      lastError: error,
    };

    try {
      // Store delivery details
      await this.redis.set(
        `${this.DELIVERY_PREFIX}${deliveryId}`,
        JSON.stringify(delivery),
        'EX',
        86400 * 7 // 7 days TTL
      );

      // Add to sorted set (score = nextRetryAt)
      await this.redis.zadd(this.RETRY_QUEUE_KEY, delivery.nextRetryAt, deliveryId);

      this.logger.log(
        `Queued webhook ${webhook.id} for retry (delivery ${deliveryId}), next attempt in ${Math.round(backoff / 1000)}s`
      );
    } catch (err) {
      this.logger.error(`Failed to queue webhook for retry: ${err}`);
    }
  }

  /**
   * Process retry queue - runs every 10 seconds.
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processRetryQueue(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    const now = Date.now();

    try {
      // Get deliveries ready for retry (score <= now)
      const deliveryIds = await this.redis.zrangebyscore(
        this.RETRY_QUEUE_KEY,
        0,
        now,
        'LIMIT',
        0,
        10 // Process up to 10 at a time
      );

      for (const deliveryId of deliveryIds) {
        await this.processDelivery(deliveryId);
      }
    } catch (err) {
      this.logger.error(`Error processing retry queue: ${err}`);
    }
  }

  private async processDelivery(deliveryId: string): Promise<void> {
    try {
      // Get delivery details
      const data = await this.redis.get(`${this.DELIVERY_PREFIX}${deliveryId}`);
      if (!data) {
        // Delivery expired or already processed
        await this.redis.zrem(this.RETRY_QUEUE_KEY, deliveryId);
        return;
      }

      const delivery: WebhookDelivery = JSON.parse(data);

      this.logger.log(
        `Retrying webhook delivery ${deliveryId} (attempt ${delivery.attempt}/${delivery.maxRetries})`
      );

      // Attempt delivery
      const success = await this.sendWebhook(delivery);

      if (success) {
        // Success - clean up
        await this.removeDelivery(deliveryId);
        this.logger.log(`Webhook delivery ${deliveryId} succeeded on retry`);
      } else if (delivery.attempt >= delivery.maxRetries) {
        // Max retries reached - give up
        await this.removeDelivery(deliveryId);
        this.logger.error(
          `Webhook delivery ${deliveryId} failed after ${delivery.maxRetries} attempts, giving up`
        );
      } else {
        // Schedule next retry
        const nextAttempt = delivery.attempt + 1;
        const backoff = this.calculateBackoff(nextAttempt);
        const nextRetryAt = Date.now() + backoff;

        delivery.attempt = nextAttempt;
        delivery.nextRetryAt = nextRetryAt;

        // Update delivery
        await this.redis.set(
          `${this.DELIVERY_PREFIX}${deliveryId}`,
          JSON.stringify(delivery),
          'EX',
          86400 * 7
        );

        // Update score in queue
        await this.redis.zadd(this.RETRY_QUEUE_KEY, nextRetryAt, deliveryId);

        this.logger.log(
          `Webhook delivery ${deliveryId} scheduled for retry ${nextAttempt}/${delivery.maxRetries} in ${Math.round(backoff / 1000)}s`
        );
      }
    } catch (err) {
      this.logger.error(`Error processing delivery ${deliveryId}: ${err}`);
    }
  }

  private async sendWebhook(delivery: WebhookDelivery): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(delivery.url, {
        method: delivery.method,
        headers: delivery.headers,
        body: delivery.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        delivery.lastError = `HTTP ${response.status}: ${text.substring(0, 200)}`;
        return false;
      }

      return true;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          delivery.lastError = 'Request timed out after 30 seconds';
        } else {
          const cause = (error as Error & { cause?: Error }).cause;
          delivery.lastError = cause?.message || error.message;
        }
      } else {
        delivery.lastError = 'Unknown error';
      }
      return false;
    }
  }

  private async removeDelivery(deliveryId: string): Promise<void> {
    await this.redis.del(`${this.DELIVERY_PREFIX}${deliveryId}`);
    await this.redis.zrem(this.RETRY_QUEUE_KEY, deliveryId);
  }

  /**
   * Get pending retry count (for health checks/metrics).
   */
  async getPendingCount(): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }
    return this.redis.zcard(this.RETRY_QUEUE_KEY);
  }

  /**
   * Get pending deliveries (for debugging/admin).
   */
  async getPendingDeliveries(): Promise<WebhookDelivery[]> {
    if (!this.isConnected) {
      return [];
    }

    const deliveryIds = await this.redis.zrange(this.RETRY_QUEUE_KEY, 0, -1);

    const deliveries: WebhookDelivery[] = [];
    for (const id of deliveryIds) {
      const data = await this.redis.get(`${this.DELIVERY_PREFIX}${id}`);
      if (data) {
        deliveries.push(JSON.parse(data));
      }
    }

    return deliveries;
  }
}
