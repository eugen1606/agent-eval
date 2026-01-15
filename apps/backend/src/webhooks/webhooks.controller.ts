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
import { Webhook, WebhookEvent, WebhookMethod } from '../database/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WebhookVariableDefinition } from '@agent-eval/shared';

const VALID_EVENTS: WebhookEvent[] = ['run.running', 'run.completed', 'run.failed', 'run.evaluated'];
const VALID_METHODS: WebhookMethod[] = ['POST', 'PUT', 'PATCH'];

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

  @Get('variables')
  getAvailableVariables(): { variables: WebhookVariableDefinition[] } {
    return { variables: this.webhooksService.getAvailableVariables() };
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
    if (dto.method) {
      this.validateMethod(dto.method);
    }
    if (dto.headers !== undefined) {
      this.validateHeaders(dto.headers);
    }
    if (dto.queryParams !== undefined) {
      this.validateQueryParams(dto.queryParams);
    }
    if (dto.bodyTemplate !== undefined) {
      this.validateBodyTemplate(dto.bodyTemplate);
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
    await this.webhooksService.findOne(id, user.userId);

    try {
      await this.webhooksService.triggerWebhooks(user.userId, 'run.evaluated', {
        runId: '00000000-0000-0000-0000-000000000000',
        runStatus: 'completed',
        testId: '00000000-0000-0000-0000-000000000001',
        testName: 'Test Webhook',
        totalQuestions: 10,
        completedQuestions: 10,
        accuracy: 85.0,
        correctCount: 8,
        partialCount: 1,
        incorrectCount: 1,
        errorCount: 0,
        evaluatedCount: 10,
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
    this.validateMethod(dto.method);
    this.validateBodyTemplate(dto.bodyTemplate);
    if (dto.headers !== undefined) {
      this.validateHeaders(dto.headers);
    }
    if (dto.queryParams !== undefined) {
      this.validateQueryParams(dto.queryParams);
    }
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

  private validateMethod(method: WebhookMethod): void {
    if (!method) {
      throw new BadRequestException('HTTP method is required');
    }
    if (!VALID_METHODS.includes(method)) {
      throw new BadRequestException(`Invalid HTTP method: ${method}. Valid methods are: ${VALID_METHODS.join(', ')}`);
    }
  }

  private validateHeaders(headers: Record<string, string> | undefined): void {
    if (headers === null) {
      throw new BadRequestException('Headers must be an object or undefined');
    }
    if (headers && typeof headers !== 'object') {
      throw new BadRequestException('Headers must be an object');
    }
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        if (typeof key !== 'string' || typeof value !== 'string') {
          throw new BadRequestException('Header keys and values must be strings');
        }
      }
    }
  }

  private validateQueryParams(params: Record<string, string> | undefined): void {
    if (params === null) {
      throw new BadRequestException('Query parameters must be an object or undefined');
    }
    if (params && typeof params !== 'object') {
      throw new BadRequestException('Query parameters must be an object');
    }
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (typeof key !== 'string' || typeof value !== 'string') {
          throw new BadRequestException('Query parameter keys and values must be strings');
        }
      }
    }
  }

  private validateBodyTemplate(bodyTemplate: Record<string, unknown>): void {
    if (!bodyTemplate) {
      throw new BadRequestException('Body template is required');
    }
    if (typeof bodyTemplate !== 'object' || Array.isArray(bodyTemplate)) {
      throw new BadRequestException('Body template must be a JSON object');
    }
  }
}
