import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ScheduledEvaluationsService, CreateScheduledEvaluationDto } from './scheduled-evaluations.service';
import { ScheduledEvaluation } from '../database/entities/scheduled-evaluation.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('scheduled-evaluations')
@UseGuards(JwtAuthGuard)
export class ScheduledEvaluationsController {
  constructor(private readonly scheduledEvaluationsService: ScheduledEvaluationsService) {}

  @Post()
  async create(
    @Body() dto: CreateScheduledEvaluationDto,
    @CurrentUser() user: { userId: string; email: string }
  ): Promise<ScheduledEvaluation> {
    return this.scheduledEvaluationsService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @CurrentUser() user: { userId: string; email: string }
  ): Promise<ScheduledEvaluation[]> {
    return this.scheduledEvaluationsService.findAll(user.userId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string }
  ): Promise<ScheduledEvaluation> {
    return this.scheduledEvaluationsService.findOne(id, user.userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateScheduledEvaluationDto>,
    @CurrentUser() user: { userId: string; email: string }
  ): Promise<ScheduledEvaluation> {
    return this.scheduledEvaluationsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string }
  ): Promise<void> {
    return this.scheduledEvaluationsService.delete(id, user.userId);
  }

  @Post(':id/reset')
  async resetToPending(
    @Param('id') id: string,
    @Body() body: { scheduledAt?: string },
    @CurrentUser() user: { userId: string; email: string }
  ): Promise<ScheduledEvaluation> {
    return this.scheduledEvaluationsService.resetToPending(id, user.userId, body.scheduledAt);
  }

  @Post(':id/execute')
  async executeNow(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string }
  ): Promise<{ message: string }> {
    // Verify user owns this scheduled evaluation
    await this.scheduledEvaluationsService.findOne(id, user.userId);
    // Execute it
    await this.scheduledEvaluationsService.executeScheduledEvaluation(id);
    return { message: 'Execution started' };
  }
}
