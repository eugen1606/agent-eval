import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { WebhooksService, CreateWebhookDto } from './webhooks.service';
import { Webhook, WebhookEvent } from '../database/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const VALID_EVENTS: WebhookEvent[] = ['evaluation.completed', 'scheduled.completed', 'scheduled.failed'];

@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  async create(
    @Body() dto: CreateWebhookDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Webhook> {
    this.validateWebhookDto(dto);
    return this.webhooksService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Webhook[]> {
    return this.webhooksService.findAll(user.userId);
  }

  @Get('events')
  getAvailableEvents(): { events: WebhookEvent[] } {
    return { events: VALID_EVENTS };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Webhook> {
    return this.webhooksService.findOne(id, user.userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateWebhookDto>,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Webhook> {
    if (dto.events) {
      this.validateEvents(dto.events);
    }
    if (dto.url) {
      this.validateUrl(dto.url);
    }
    return this.webhooksService.update(id, dto, user.userId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<void> {
    return this.webhooksService.delete(id, user.userId);
  }

  @Post(':id/toggle')
  async toggleEnabled(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Webhook> {
    return this.webhooksService.toggleEnabled(id, user.userId);
  }

  @Post(':id/test')
  async testWebhook(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<{ success: boolean; message: string }> {
    const webhook = await this.webhooksService.findOne(id, user.userId);

    try {
      await this.webhooksService.triggerWebhooks(user.userId, 'evaluation.completed', {
        test: true,
        message: 'This is a test webhook from BenchMark',
        webhookId: webhook.id,
      });
      return { success: true, message: 'Test webhook sent successfully' };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Failed to send test webhook' };
    }
  }

  private validateWebhookDto(dto: CreateWebhookDto): void {
    if (!dto.name || dto.name.trim() === '') {
      throw new BadRequestException('Name is required');
    }
    this.validateUrl(dto.url);
    this.validateEvents(dto.events);
  }

  private validateUrl(url: string): void {
    if (!url) {
      throw new BadRequestException('URL is required');
    }
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new BadRequestException('URL must use HTTP or HTTPS protocol');
      }
    } catch {
      throw new BadRequestException('Invalid URL format');
    }
  }

  private validateEvents(events: WebhookEvent[]): void {
    if (!events || !Array.isArray(events) || events.length === 0) {
      throw new BadRequestException('At least one event must be selected');
    }
    for (const event of events) {
      if (!VALID_EVENTS.includes(event)) {
        throw new BadRequestException(`Invalid event: ${event}`);
      }
    }
  }
}
