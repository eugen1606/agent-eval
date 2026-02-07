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
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
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
import { RunComparison } from '@agent-eval/shared';

@ApiTags('runs')
@Controller('runs')
@UseGuards(JwtAuthGuard)
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new run' })
  @ApiResponse({ status: 201, description: 'Run created' })
  async create(
    @Body() dto: CreateRunDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Run> {
    return this.runsService.create(dto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all runs with pagination and filtering' })
  @ApiResponse({ status: 200, description: 'Paginated list of runs' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: RunStatus,
    @Query('testId') testId?: string,
    @Query('runId') runId?: string,
    @Query('questionSetId') questionSetId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDirection') sortDirection?: string,
    @CurrentUser() user?: { userId: string; email: string },
  ): Promise<PaginatedRuns> {
    return this.runsService.findAll(user!.userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      status,
      testId,
      runId,
      questionSetId,
      sortBy: sortBy as 'createdAt' | 'startedAt' | 'completedAt' | 'status' | undefined,
      sortDirection: sortDirection as 'asc' | 'desc' | undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a run by ID' })
  @ApiResponse({ status: 200, description: 'Run found' })
  @ApiResponse({ status: 404, description: 'Run not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Run> {
    return this.runsService.findOne(id, user.userId);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get evaluation statistics for a run' })
  @ApiResponse({ status: 200, description: 'Run evaluation stats (correct, partial, incorrect counts)' })
  async getStats(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.runsService.getStats(id, user.userId);
  }

  @Get(':id/performance')
  @ApiOperation({ summary: 'Get performance statistics for a run (latency metrics)' })
  @ApiResponse({ status: 200, description: 'Performance stats (avg, p50, p95, max latency)' })
  async getPerformance(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.runsService.getPerformanceStats(id, user.userId);
  }

  @Get(':id/compare/:otherId')
  @ApiOperation({ summary: 'Compare two runs side by side' })
  @ApiResponse({ status: 200, description: 'Comparison of two runs with matched results' })
  async compareRuns(
    @Param('id') id: string,
    @Param('otherId') otherId: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<RunComparison> {
    return this.runsService.compareRuns(id, otherId, user.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a run' })
  @ApiResponse({ status: 200, description: 'Run updated' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRunDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Run> {
    return this.runsService.update(id, dto, user.userId);
  }

  @Put(':id/results/:resultId/evaluation')
  @ApiOperation({ summary: 'Evaluate a single result (correct/partial/incorrect)' })
  @ApiResponse({ status: 200, description: 'Evaluation saved' })
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
  @ApiOperation({ summary: 'Bulk update evaluations for multiple results' })
  @ApiResponse({ status: 200, description: 'Evaluations updated' })
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
  @ApiOperation({ summary: 'Cancel a running test execution' })
  @ApiResponse({ status: 200, description: 'Run canceled' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Run> {
    return this.runsService.cancel(id, user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a run' })
  @ApiResponse({ status: 200, description: 'Run deleted' })
  @ApiResponse({ status: 404, description: 'Run not found' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<{ success: boolean }> {
    await this.runsService.delete(id, user.userId);
    return { success: true };
  }
}
