import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook, WebhookEvent, Test } from '../database/entities';
import {
  VariableResolverService,
  WebhookContext,
} from './variable-resolver.service';
import { WebhookRetryService } from './webhook-retry.service';
import { UrlValidationService } from '../common/validators/url-validation.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';

export interface EntityUsage {
  tests: { id: string; name: string }[];
}

export type WebhooksSortField = 'name' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export interface WebhooksFilterDto {
  page?: number;
  limit?: number;
  search?: string;
  enabled?: boolean;
  event?: WebhookEvent;
  sortBy?: WebhooksSortField;
  sortDirection?: SortDirection;
}

export interface PaginatedWebhooks {
  data: Webhook[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(Webhook)
    private webhookRepository: Repository<Webhook>,
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
    private variableResolver: VariableResolverService,
    private webhookRetryService: WebhookRetryService,
    private urlValidationService: UrlValidationService,
  ) {}

  async create(dto: CreateWebhookDto, userId: string): Promise<Webhook> {
    const webhook = this.webhookRepository.create({
      ...dto,
      userId,
    });
    return this.webhookRepository.save(webhook);
  }

  async findAll(
    userId: string,
    filters: WebhooksFilterDto = {},
  ): Promise<PaginatedWebhooks> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.webhookRepository
      .createQueryBuilder('webhook')
      .where('webhook.userId = :userId', { userId });

    // Apply search filter
    if (filters.search) {
      queryBuilder.andWhere(
        '(webhook.name ILIKE :search OR webhook.description ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Apply enabled filter
    if (filters.enabled !== undefined) {
      queryBuilder.andWhere('webhook.enabled = :enabled', {
        enabled: filters.enabled,
      });
    }

    // Apply event filter (search in events array)
    if (filters.event) {
      queryBuilder.andWhere(':event = ANY(webhook.events)', {
        event: filters.event,
      });
    }

    // Apply sorting
    const sortField = filters.sortBy || 'createdAt';
    const sortDirection =
      (filters.sortDirection?.toUpperCase() as 'ASC' | 'DESC') || 'DESC';
    queryBuilder.orderBy(`webhook.${sortField}`, sortDirection);

    // Get total count and paginated data in one call
    const [data, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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
    dto: UpdateWebhookDto,
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

  async getUsage(id: string, userId: string): Promise<EntityUsage> {
    // Verify webhook exists and belongs to user
    await this.findOne(id, userId);

    // Find tests that use this webhook
    const tests = await this.testRepository.find({
      where: { webhookId: id, userId },
      select: ['id', 'name'],
    });

    return {
      tests: tests.map((t) => ({ id: t.id, name: t.name })),
    };
  }

  async toggleEnabled(id: string, userId: string): Promise<Webhook> {
    const webhook = await this.findOne(id, userId);
    webhook.enabled = !webhook.enabled;
    const savedWebhook = await this.webhookRepository.save(webhook);

    // When disabling a webhook, remove it from all tests that use it
    if (!webhook.enabled) {
      await this.testRepository.update(
        { webhookId: id, userId },
        { webhookId: null as unknown as string },
      );
    }

    return savedWebhook;
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

    // Validate URL for SSRF protection (with DNS resolution check)
    try {
      await this.urlValidationService.validateUrl(finalUrl, {
        context: 'Webhook URL',
        skipDnsCheck: false, // Perform DNS check at execution time
      });
    } catch (error) {
      this.logger.warn(
        `Webhook ${webhook.id} blocked by SSRF protection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Don't queue for retry - this is a configuration issue, not a transient failure
      return;
    }

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

    this.logger.debug(
      `Webhook payload: ${JSON.stringify({ method: webhook.method || 'POST', headers, body: resolvedBody })}`,
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
        const errorMsg = `HTTP ${response.status}: ${responseText.substring(0, 200)}`;
        this.logger.warn(`Webhook ${webhook.id} returned status ${response.status}: ${responseText}`);

        // Queue for retry on non-2xx responses
        await this.webhookRetryService.queueForRetry(
          webhook,
          finalUrl,
          resolvedHeaders,
          resolvedBody,
          errorMsg,
        );
      } else {
        this.logger.log(`Webhook ${webhook.id} delivered successfully`);
      }
    } catch (error) {
      let errorMsg = 'Unknown error';

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMsg = 'Request timed out after 30 seconds';
          this.logger.error(`Webhook ${webhook.id} timed out after 30 seconds`);
        } else {
          // Get the underlying cause if available (Node.js fetch wraps errors)
          const cause = (error as Error & { cause?: Error }).cause;
          const causeMessage = cause ? `: ${cause.message}` : '';
          const causeCode = (cause as Error & { code?: string })?.code;
          const codeMessage = causeCode ? ` (${causeCode})` : '';

          errorMsg = `${error.message}${causeMessage}${codeMessage}`;
          this.logger.error(`Webhook ${webhook.id} failed: ${errorMsg}`);

          if (cause?.stack) {
            this.logger.debug(`Cause stack: ${cause.stack}`);
          }
        }
      } else {
        this.logger.error(`Webhook ${webhook.id} failed: Unknown error`);
      }

      // Queue for retry on network/timeout errors
      await this.webhookRetryService.queueForRetry(
        webhook,
        finalUrl,
        resolvedHeaders,
        resolvedBody,
        errorMsg,
      );
    }
  }

  getAvailableVariables() {
    return this.variableResolver.getAvailableVariables();
  }
}
