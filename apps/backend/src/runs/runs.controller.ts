import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Sse,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Observable, Subject } from 'rxjs';
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
import { RunComparison, LLMEvaluationResult, BulkLLMEvaluationRequest } from '@agent-eval/shared';
import { ReportService } from './report.service';
import { EvaluationService } from '../evaluation/evaluation.service';
import { EvaluatorsService } from '../evaluators/evaluators.service';
import { AccessTokensService } from '../access-tokens/access-tokens.service';

interface MessageEvent {
  data: string;
}

@ApiTags('runs')
@Controller('runs')
@UseGuards(JwtAuthGuard)
export class RunsController {
  private readonly logger = new Logger(RunsController.name);

  constructor(
    private readonly runsService: RunsService,
    private readonly reportService: ReportService,
    private readonly evaluationService: EvaluationService,
    private readonly evaluatorsService: EvaluatorsService,
    private readonly accessTokensService: AccessTokensService,
  ) {}

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

  @Get('export/dashboard-csv')
  @ApiOperation({ summary: 'Export dashboard analytics as CSV' })
  @ApiQuery({ name: 'testId', required: true })
  @ApiResponse({ status: 200, description: 'CSV file' })
  @ApiResponse({ status: 400, description: 'testId is required' })
  async exportDashboardCsv(
    @Query('testId') testId: string,
    @CurrentUser() user: { userId: string; email: string },
    @Res() res: Response,
  ): Promise<void> {
    if (!testId) {
      throw new BadRequestException('testId is required');
    }

    const { data: runs } = await this.runsService.findAll(user.userId, {
      testId,
      status: 'completed' as const,
      limit: 1000,
    });

    const rows = runs.map((run) => {
      const stats = this.runsService.getStatsFromRun(run);
      const perfStats = this.runsService.getPerformanceStatsFromRun(run);
      return {
        runId: run.id,
        date: run.completedAt
          ? new Date(run.completedAt).toISOString()
          : new Date(run.createdAt).toISOString(),
        accuracy: stats.accuracy,
        correct: stats.correct,
        partial: stats.partial,
        incorrect: stats.incorrect,
        errors: stats.errors,
        total: stats.total,
        avgLatencyMs: perfStats.avg,
      };
    });

    const testName = runs[0]?.test?.name || 'dashboard';
    const csv = this.reportService.generateDashboardCsv(testName, rows);
    const date = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="dashboard-${date}.csv"`,
    );
    res.send(csv);
  }

  @Get(':id/export/csv')
  @ApiOperation({ summary: 'Export run results as CSV' })
  @ApiParam({ name: 'id', description: 'Run ID' })
  @ApiResponse({ status: 200, description: 'CSV file' })
  @ApiResponse({ status: 404, description: 'Run not found' })
  async exportRunCsv(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
    @Res() res: Response,
  ): Promise<void> {
    const run = await this.runsService.findOne(id, user.userId);
    const stats = this.runsService.getStatsFromRun(run);
    const perfStats = this.runsService.getPerformanceStatsFromRun(run);
    const csv = this.reportService.generateRunCsv(run, stats, perfStats);

    const shortId = run.id.slice(0, 8);
    const date = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="run-${shortId}-${date}.csv"`,
    );
    res.send(csv);
  }

  @Get(':id/export/pdf')
  @ApiOperation({ summary: 'Export run report as PDF' })
  @ApiParam({ name: 'id', description: 'Run ID' })
  @ApiResponse({ status: 200, description: 'PDF file' })
  @ApiResponse({ status: 404, description: 'Run not found' })
  async exportRunPdf(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
    @Res() res: Response,
  ): Promise<void> {
    const run = await this.runsService.findOne(id, user.userId);
    const stats = this.runsService.getStatsFromRun(run);
    const perfStats = this.runsService.getPerformanceStatsFromRun(run);
    const pdf = await this.reportService.generateRunPdf(run, stats, perfStats);

    const shortId = run.id.slice(0, 8);
    const date = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="run-report-${shortId}-${date}.pdf"`,
    );
    res.send(pdf);
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

  @Post(':id/evaluate-llm')
  @Sse()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Bulk evaluate run results with LLM (SSE stream)' })
  evaluateBulkLLM(
    @Param('id') id: string,
    @Body() body: BulkLLMEvaluationRequest,
    @CurrentUser() user: { userId: string; email: string },
  ): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();

    this.handleBulkEvaluation(id, body, user.userId, subject).catch((error) => {
      subject.next({
        data: JSON.stringify({ type: 'eval_error', error: error.message }),
      });
      subject.complete();
    });

    return subject.asObservable();
  }

  private async handleBulkEvaluation(
    runId: string,
    body: BulkLLMEvaluationRequest,
    userId: string,
    subject: Subject<MessageEvent>,
  ): Promise<void> {
    try {
      // 1. Fetch run
      const run = await this.runsService.findOne(runId, userId);

      // 2. Fetch evaluator (validates ownership)
      const evaluator = await this.evaluatorsService.findOneEntity(body.evaluatorId, userId);
      if (!evaluator.accessTokenId) {
        throw new Error('Evaluator has no associated credential');
      }

      // 3. Decrypt API key
      const apiKey = await this.accessTokensService.getDecryptedToken(evaluator.accessTokenId, userId);

      // 4. Determine provider from access token type
      const tokenInfo = await this.accessTokensService.findOne(evaluator.accessTokenId, userId);
      const provider = tokenInfo.type as 'openai' | 'anthropic';

      // 5. Filter results
      let results = run.results.filter((r) => !r.isError);
      if (body.resultIds && body.resultIds.length > 0) {
        const idSet = new Set(body.resultIds);
        results = results.filter((r) => idSet.has(r.id));
      }
      if (!body.overrideExisting) {
        results = results.filter((r) => r.llmJudgeScore === undefined || r.llmJudgeScore === null);
      }

      subject.next({
        data: JSON.stringify({ type: 'eval_start', runId, totalResults: results.length }),
      });

      let evaluatedCount = 0;

      // 6. Iterate and evaluate
      for (const result of results) {
        try {
          const llmResult = await this.evaluationService.evaluateWithLLM(
            result.question,
            result.answer,
            result.expectedAnswer,
            { apiKey, provider, model: evaluator.model, systemPrompt: evaluator.systemPrompt, reasoningModel: evaluator.reasoningModel, reasoningEffort: evaluator.reasoningEffort },
          );

          const suggestedEvaluation = EvaluationService.scoreToEvaluation(llmResult.score);

          // 7. Save to run JSONB
          await this.runsService.updateResultEvaluation(runId, {
            resultId: result.id,
            llmJudgeScore: llmResult.score,
            llmJudgeReasoning: llmResult.reasoning,
          }, userId);

          evaluatedCount++;

          subject.next({
            data: JSON.stringify({
              type: 'eval_result',
              resultId: result.id,
              llmJudgeScore: llmResult.score,
              llmJudgeReasoning: llmResult.reasoning,
              suggestedEvaluation,
            }),
          });
        } catch (error) {
          this.logger.error(`Failed to evaluate result ${result.id}`, error);
          subject.next({
            data: JSON.stringify({
              type: 'eval_error',
              resultId: result.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          });
        }
      }

      subject.next({
        data: JSON.stringify({ type: 'eval_complete', runId, evaluatedCount }),
      });
    } finally {
      subject.complete();
    }
  }

  @Post(':id/results/:resultId/evaluate-llm')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Evaluate a single result with LLM' })
  async evaluateSingleLLM(
    @Param('id') id: string,
    @Param('resultId') resultId: string,
    @Body() body: { evaluatorId: string },
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<LLMEvaluationResult> {
    // Fetch run and find the result
    const run = await this.runsService.findOne(id, user.userId);
    const result = run.results.find((r) => r.id === resultId);
    if (!result) {
      throw new NotFoundException(`Result not found: ${resultId}`);
    }

    // Fetch evaluator
    const evaluator = await this.evaluatorsService.findOneEntity(body.evaluatorId, user.userId);
    if (!evaluator.accessTokenId) {
      throw new NotFoundException('Evaluator has no associated credential');
    }

    // Decrypt API key
    const apiKey = await this.accessTokensService.getDecryptedToken(evaluator.accessTokenId, user.userId);
    const tokenInfo = await this.accessTokensService.findOne(evaluator.accessTokenId, user.userId);
    const provider = tokenInfo.type as 'openai' | 'anthropic';

    // Evaluate
    const llmResult = await this.evaluationService.evaluateWithLLM(
      result.question,
      result.answer,
      result.expectedAnswer,
      { apiKey, provider, model: evaluator.model, systemPrompt: evaluator.systemPrompt, reasoningModel: evaluator.reasoningModel, reasoningEffort: evaluator.reasoningEffort },
    );

    const suggestedEvaluation = EvaluationService.scoreToEvaluation(llmResult.score);

    // Save
    await this.runsService.updateResultEvaluation(id, {
      resultId,
      llmJudgeScore: llmResult.score,
      llmJudgeReasoning: llmResult.reasoning,
    }, user.userId);

    return {
      resultId,
      llmJudgeScore: llmResult.score,
      llmJudgeReasoning: llmResult.reasoning,
      suggestedEvaluation,
    };
  }
}
