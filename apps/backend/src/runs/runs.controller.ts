import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  RunsService,
  CreateRunDto,
  UpdateRunDto,
  UpdateResultEvaluationDto,
  PaginatedRuns,
} from './runs.service';
import { Run, RunStatus } from '../database/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('runs')
@UseGuards(JwtAuthGuard)
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Post()
  async create(
    @Body() dto: CreateRunDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Run> {
    return this.runsService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: RunStatus,
    @Query('testId') testId?: string,
    @Query('runId') runId?: string,
    @CurrentUser() user?: { userId: string; email: string },
  ): Promise<PaginatedRuns> {
    return this.runsService.findAll(user!.userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      status,
      testId,
      runId,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Run> {
    return this.runsService.findOne(id, user.userId);
  }

  @Get(':id/stats')
  async getStats(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.runsService.getStats(id, user.userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRunDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Run> {
    return this.runsService.update(id, dto, user.userId);
  }

  @Put(':id/results/:resultId/evaluation')
  async updateResultEvaluation(
    @Param('id') id: string,
    @Param('resultId') resultId: string,
    @Body() dto: Omit<UpdateResultEvaluationDto, 'resultId'>,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Run> {
    return this.runsService.updateResultEvaluation(
      id,
      { ...dto, resultId },
      user.userId,
    );
  }

  @Put(':id/results/evaluations')
  async bulkUpdateResultEvaluations(
    @Param('id') id: string,
    @Body() dto: { updates: UpdateResultEvaluationDto[] },
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Run> {
    return this.runsService.bulkUpdateResultEvaluations(
      id,
      dto.updates,
      user.userId,
    );
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Run> {
    return this.runsService.cancel(id, user.userId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<{ success: boolean }> {
    await this.runsService.delete(id, user.userId);
    return { success: true };
  }
}
