import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Run, RunStatus, Test } from '../database/entities';
import { WebhooksService } from '../webhooks/webhooks.service';
import {
  RunComparison,
  ComparisonResult,
  ChangeType,
  RunComparisonSummary,
  HumanEvaluationStatus,
} from '@agent-eval/shared';

export interface CreateRunDto {
  testId: string;
  totalQuestions?: number;
  questionSetId?: string;
}

export interface UpdateRunDto {
  status?: RunStatus;
  errorMessage?: string;
  completedQuestions?: number;
  startedAt?: Date | string;
  completedAt?: Date | string;
}

export interface UpdateResultEvaluationDto {
  resultId: string;
  humanEvaluation?: 'correct' | 'incorrect' | 'partial';
  humanEvaluationDescription?: string;
  severity?: 'critical' | 'major' | 'minor';
  llmJudgeScore?: number;
  llmJudgeReasoning?: string;
}

export type RunsSortField = 'createdAt' | 'startedAt' | 'completedAt' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface RunsFilterDto {
  page?: number;
  limit?: number;
  search?: string;
  status?: RunStatus;
  testId?: string;
  runId?: string;
  questionSetId?: string;
  sortBy?: RunsSortField;
  sortDirection?: SortDirection;
}

export interface PaginatedRuns {
  data: Run[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class RunsService {
  constructor(
    @InjectRepository(Run)
    private runRepository: Repository<Run>,
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
    private webhooksService: WebhooksService,
  ) {}

  async create(dto: CreateRunDto, userId: string): Promise<Run> {
    const run = this.runRepository.create({
      testId: dto.testId,
      totalQuestions: dto.totalQuestions ?? 0,
      questionSetId: dto.questionSetId,
      status: 'pending',
      results: [],
      userId,
    });
    return this.runRepository.save(run);
  }

  async findAll(
    userId: string,
    filters: RunsFilterDto = {},
  ): Promise<PaginatedRuns> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.runRepository
      .createQueryBuilder('run')
      .leftJoinAndSelect('run.test', 'test')
      .where('run.userId = :userId', { userId });

    // Apply testId filter
    if (filters.testId) {
      queryBuilder.andWhere('run.testId = :testId', { testId: filters.testId });
    }

    // Apply runId filter (partial match - cast UUID to text)
    if (filters.runId) {
      queryBuilder.andWhere('run.id::text ILIKE :runId', {
        runId: `%${filters.runId}%`,
      });
    }

    // Apply status filter
    if (filters.status) {
      queryBuilder.andWhere('run.status = :status', { status: filters.status });
    }

    // Apply search filter (search by test name)
    if (filters.search) {
      queryBuilder.andWhere('test.name ILIKE :search', {
        search: `%${filters.search}%`,
      });
    }

    // Apply questionSetId filter
    if (filters.questionSetId) {
      queryBuilder.andWhere('run.questionSetId = :questionSetId', {
        questionSetId: filters.questionSetId,
      });
    }

    // Get total count before pagination
    const total = await queryBuilder.getCount();

    // Apply sorting
    const sortField = filters.sortBy || 'createdAt';
    const sortDirection = (filters.sortDirection?.toUpperCase() as 'ASC' | 'DESC') || 'DESC';
    queryBuilder.orderBy(`run.${sortField}`, sortDirection);

    // Apply pagination
    const data = await queryBuilder
      .skip(skip)
      .take(limit)
      .getMany();

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

  async findOne(id: string, userId: string): Promise<Run> {
    const run = await this.runRepository.findOne({
      where: { id, userId },
      relations: ['test', 'test.questionSet'],
    });
    if (!run) {
      throw new NotFoundException(`Run not found: ${id}`);
    }
    return run;
  }

  async update(id: string, dto: UpdateRunDto, userId: string): Promise<Run> {
    const run = await this.findOne(id, userId);

    if (dto.status !== undefined) run.status = dto.status;
    if (dto.errorMessage !== undefined) run.errorMessage = dto.errorMessage;
    if (dto.completedQuestions !== undefined)
      run.completedQuestions = dto.completedQuestions;
    if (dto.completedAt !== undefined) {
      run.completedAt =
        typeof dto.completedAt === 'string'
          ? new Date(dto.completedAt)
          : dto.completedAt;
    }

    return this.runRepository.save(run);
  }

  async delete(id: string, userId: string): Promise<void> {
    const run = await this.findOne(id, userId);
    await this.runRepository.remove(run);
  }

  async start(id: string, userId: string): Promise<Run> {
    const run = await this.findOne(id, userId);
    run.status = 'running';
    run.startedAt = new Date();
    return this.runRepository.save(run);
  }

  async complete(id: string, userId: string): Promise<Run> {
    const run = await this.findOne(id, userId);
    run.status = 'completed';
    run.completedAt = new Date();
    return this.runRepository.save(run);
  }

  async fail(id: string, errorMessage: string, userId: string): Promise<Run> {
    const run = await this.findOne(id, userId);
    run.status = 'failed';
    run.errorMessage = errorMessage;
    run.completedAt = new Date();
    return this.runRepository.save(run);
  }

  async cancel(id: string, userId: string): Promise<Run> {
    const run = await this.findOne(id, userId);
    if (run.status !== 'running' && run.status !== 'pending') {
      return run;
    }
    run.status = 'canceled';
    run.errorMessage = 'Canceled by user';
    run.completedAt = new Date();
    return this.runRepository.save(run);
  }

  async addResult(
    id: string,
    result: Run['results'][0],
    userId: string,
  ): Promise<Run> {
    const run = await this.findOne(id, userId);
    run.results.push(result);
    run.completedQuestions = run.results.length;
    return this.runRepository.save(run);
  }

  private isRunFullyEvaluated(run: Run): boolean {
    const evaluatableResults = run.results.filter((r) => !r.isError);
    if (evaluatableResults.length === 0) return false;
    return evaluatableResults.every((r) => r.humanEvaluation !== undefined);
  }

  private async checkAndTriggerEvaluatedWebhook(
    run: Run,
    userId: string,
  ): Promise<Run> {
    // Skip if already evaluated
    if (run.isFullyEvaluated) return run;

    // Check if all evaluatable questions have been evaluated
    if (!this.isRunFullyEvaluated(run)) return run;

    // Mark as fully evaluated
    run.isFullyEvaluated = true;
    run.evaluatedAt = new Date();
    const savedRun = await this.runRepository.save(run);

    // Trigger webhook if test has one configured
    if (run.testId) {
      const test = await this.testRepository.findOne({
        where: { id: run.testId },
      });

      if (test?.webhookId) {
        const stats = this.calculateStats(savedRun);
        const perfStats = this.calculatePerformanceStats(savedRun);
        this.webhooksService.triggerWebhooks(userId, 'run.evaluated', {
          runId: savedRun.id,
          runStatus: savedRun.status,
          testId: test.id,
          testName: test.name,
          totalQuestions: savedRun.totalQuestions,
          completedQuestions: savedRun.completedQuestions,
          accuracy: stats.accuracy,
          correctCount: stats.correct,
          partialCount: stats.partial,
          incorrectCount: stats.incorrect,
          errorCount: stats.errors,
          evaluatedCount: stats.evaluated,
          avgLatencyMs: perfStats.avg,
          p95LatencyMs: perfStats.p95,
          maxLatencyMs: perfStats.max,
        });
      }
    }

    return savedRun;
  }

  private calculateStats(run: Run): {
    total: number;
    evaluated: number;
    correct: number;
    partial: number;
    incorrect: number;
    errors: number;
    accuracy: number | null;
  } {
    const total = run.results.length;
    const errors = run.results.filter((r) => r.isError).length;
    const evaluated = run.results.filter(
      (r) => r.humanEvaluation && !r.isError,
    ).length;
    const correct = run.results.filter(
      (r) => r.humanEvaluation === 'correct',
    ).length;
    const partial = run.results.filter(
      (r) => r.humanEvaluation === 'partial',
    ).length;
    const incorrect = run.results.filter(
      (r) => r.humanEvaluation === 'incorrect',
    ).length;

    const evaluatable = total - errors;
    const accuracy =
      evaluatable > 0 && evaluated === evaluatable
        ? Math.round(((correct + partial * 0.5) / evaluatable) * 100)
        : null;

    return { total, evaluated, correct, partial, incorrect, errors, accuracy };
  }

  async updateResultEvaluation(
    id: string,
    dto: UpdateResultEvaluationDto,
    userId: string,
  ): Promise<Run> {
    const run = await this.findOne(id, userId);

    const resultIndex = run.results.findIndex((r) => r.id === dto.resultId);
    if (resultIndex === -1) {
      throw new NotFoundException(`Result not found: ${dto.resultId}`);
    }

    const result = run.results[resultIndex];
    if (dto.humanEvaluation !== undefined)
      result.humanEvaluation = dto.humanEvaluation;
    if (dto.humanEvaluationDescription !== undefined)
      result.humanEvaluationDescription = dto.humanEvaluationDescription;
    if (dto.severity !== undefined) result.severity = dto.severity;
    if (dto.llmJudgeScore !== undefined)
      result.llmJudgeScore = dto.llmJudgeScore;
    if (dto.llmJudgeReasoning !== undefined)
      result.llmJudgeReasoning = dto.llmJudgeReasoning;

    run.results[resultIndex] = result;
    const savedRun = await this.runRepository.save(run);

    // Check if run is now fully evaluated and trigger webhook
    return this.checkAndTriggerEvaluatedWebhook(savedRun, userId);
  }

  async bulkUpdateResultEvaluations(
    id: string,
    updates: UpdateResultEvaluationDto[],
    userId: string,
  ): Promise<Run> {
    const run = await this.findOne(id, userId);

    for (const dto of updates) {
      const resultIndex = run.results.findIndex((r) => r.id === dto.resultId);
      if (resultIndex === -1) continue;

      const result = run.results[resultIndex];
      if (dto.humanEvaluation !== undefined)
        result.humanEvaluation = dto.humanEvaluation;
      if (dto.humanEvaluationDescription !== undefined)
        result.humanEvaluationDescription = dto.humanEvaluationDescription;
      if (dto.severity !== undefined) result.severity = dto.severity;
      if (dto.llmJudgeScore !== undefined)
        result.llmJudgeScore = dto.llmJudgeScore;
      if (dto.llmJudgeReasoning !== undefined)
        result.llmJudgeReasoning = dto.llmJudgeReasoning;

      run.results[resultIndex] = result;
    }

    const savedRun = await this.runRepository.save(run);

    // Check if run is now fully evaluated and trigger webhook
    return this.checkAndTriggerEvaluatedWebhook(savedRun, userId);
  }

  async getStats(
    id: string,
    userId: string,
  ): Promise<{
    total: number;
    evaluated: number;
    correct: number;
    partial: number;
    incorrect: number;
    errors: number;
    accuracy: number | null;
  }> {
    const run = await this.findOne(id, userId);
    return this.calculateStats(run);
  }

  async getPerformanceStats(
    id: string,
    userId: string,
  ): Promise<{
    count: number;
    min: number | null;
    max: number | null;
    avg: number | null;
    p50: number | null;
    p95: number | null;
    p99: number | null;
  }> {
    const run = await this.findOne(id, userId);
    return this.calculatePerformanceStats(run);
  }

  getStatsFromRun(run: Run): {
    total: number;
    evaluated: number;
    correct: number;
    partial: number;
    incorrect: number;
    errors: number;
    accuracy: number | null;
  } {
    return this.calculateStats(run);
  }

  getPerformanceStatsFromRun(run: Run): {
    count: number;
    min: number | null;
    max: number | null;
    avg: number | null;
    p50: number | null;
    p95: number | null;
    p99: number | null;
  } {
    return this.calculatePerformanceStats(run);
  }

  private calculatePerformanceStats(run: Run): {
    count: number;
    min: number | null;
    max: number | null;
    avg: number | null;
    p50: number | null;
    p95: number | null;
    p99: number | null;
  } {
    const times = run.results
      .filter((r) => r.executionTimeMs !== undefined && r.executionTimeMs !== null)
      .map((r) => r.executionTimeMs as number);

    if (times.length === 0) {
      return {
        count: 0,
        min: null,
        max: null,
        avg: null,
        p50: null,
        p95: null,
        p99: null,
      };
    }

    const sorted = [...times].sort((a, b) => a - b);
    const count = sorted.length;
    const min = sorted[0];
    const max = sorted[count - 1];
    const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / count);

    const percentile = (p: number): number => {
      const index = Math.ceil((p / 100) * count) - 1;
      return sorted[Math.max(0, Math.min(index, count - 1))];
    };

    return {
      count,
      min,
      max,
      avg,
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
    };
  }

  async compareRuns(
    leftRunId: string,
    rightRunId: string,
    userId: string,
  ): Promise<RunComparison> {
    // Fetch both runs
    const leftRun = await this.findOne(leftRunId, userId);
    const rightRun = await this.findOne(rightRunId, userId);

    // Optionally validate both runs belong to the same test
    if (leftRun.testId && rightRun.testId && leftRun.testId !== rightRun.testId) {
      throw new BadRequestException('Runs must belong to the same test for comparison');
    }

    // Build comparison results by aligning on question text
    const leftResultsMap = new Map(leftRun.results.map((r) => [r.question, r]));
    const rightResultsMap = new Map(rightRun.results.map((r) => [r.question, r]));

    const allQuestions = new Set([...leftResultsMap.keys(), ...rightResultsMap.keys()]);
    const comparisonResults: ComparisonResult[] = [];

    for (const question of allQuestions) {
      const leftResult = leftResultsMap.get(question);
      const rightResult = rightResultsMap.get(question);

      const changeType = this.determineChangeType(leftResult, rightResult);

      const result: ComparisonResult = {
        question,
        leftResult: leftResult ? this.toRunResultDto(leftResult) : undefined,
        rightResult: rightResult ? this.toRunResultDto(rightResult) : undefined,
        changeType,
      };

      // Add evaluation change if both have evaluations
      if (leftResult?.humanEvaluation || rightResult?.humanEvaluation) {
        result.evaluationChange = {
          from: leftResult?.humanEvaluation as HumanEvaluationStatus | undefined,
          to: rightResult?.humanEvaluation as HumanEvaluationStatus | undefined,
        };
      }

      // Add execution time change if timing data exists
      if (leftResult?.executionTimeMs !== undefined || rightResult?.executionTimeMs !== undefined) {
        result.executionTimeChange = {
          from: leftResult?.executionTimeMs,
          to: rightResult?.executionTimeMs,
          delta:
            leftResult?.executionTimeMs !== undefined && rightResult?.executionTimeMs !== undefined
              ? rightResult.executionTimeMs - leftResult.executionTimeMs
              : undefined,
        };
      }

      comparisonResults.push(result);
    }

    // Calculate summary metrics
    const summary = this.calculateComparisonSummary(comparisonResults, leftRun, rightRun);

    return {
      leftRun: this.toStoredRunDto(leftRun),
      rightRun: this.toStoredRunDto(rightRun),
      summary,
      results: comparisonResults,
    };
  }

  private determineChangeType(
    leftResult: Run['results'][0] | undefined,
    rightResult: Run['results'][0] | undefined,
  ): ChangeType {
    if (!leftResult) return 'new';
    if (!rightResult) return 'removed';

    const leftEval = leftResult.humanEvaluation;
    const rightEval = rightResult.humanEvaluation;

    // If no evaluation data, consider unchanged
    if (!leftEval && !rightEval) return 'unchanged';
    if (!leftEval || !rightEval) return 'unchanged';

    // Define evaluation rankings (higher is better)
    const evalRank: Record<string, number> = {
      incorrect: 0,
      partial: 1,
      correct: 2,
    };

    const leftRank = evalRank[leftEval] ?? -1;
    const rightRank = evalRank[rightEval] ?? -1;

    if (rightRank > leftRank) return 'improved';
    if (rightRank < leftRank) return 'regressed';
    return 'unchanged';
  }

  private calculateComparisonSummary(
    results: ComparisonResult[],
    leftRun: Run,
    rightRun: Run,
  ): RunComparisonSummary {
    const improved = results.filter((r) => r.changeType === 'improved').length;
    const regressed = results.filter((r) => r.changeType === 'regressed').length;
    const unchanged = results.filter((r) => r.changeType === 'unchanged').length;
    const newQuestions = results.filter((r) => r.changeType === 'new').length;
    const removedQuestions = results.filter((r) => r.changeType === 'removed').length;

    // Calculate accuracy delta
    const leftStats = this.calculateStats(leftRun);
    const rightStats = this.calculateStats(rightRun);
    const accuracyDelta =
      leftStats.accuracy !== null && rightStats.accuracy !== null
        ? rightStats.accuracy - leftStats.accuracy
        : null;

    // Calculate avg latency delta
    const leftPerf = this.calculatePerformanceStats(leftRun);
    const rightPerf = this.calculatePerformanceStats(rightRun);
    const avgLatencyDelta =
      leftPerf.avg !== null && rightPerf.avg !== null
        ? rightPerf.avg - leftPerf.avg
        : null;

    return {
      improved,
      regressed,
      unchanged,
      newQuestions,
      removedQuestions,
      accuracyDelta,
      avgLatencyDelta,
    };
  }

  private toRunResultDto(result: Run['results'][0]) {
    return {
      id: result.id,
      question: result.question,
      answer: result.answer,
      expectedAnswer: result.expectedAnswer,
      executionId: result.executionId,
      executionTimeMs: result.executionTimeMs,
      isError: result.isError,
      errorMessage: result.errorMessage,
      humanEvaluation: result.humanEvaluation,
      humanEvaluationDescription: result.humanEvaluationDescription,
      severity: result.severity,
      llmJudgeScore: result.llmJudgeScore,
      llmJudgeReasoning: result.llmJudgeReasoning,
      timestamp: result.timestamp,
    };
  }

  private toStoredRunDto(run: Run) {
    return {
      id: run.id,
      testId: run.testId,
      test: run.test ? {
        id: run.test.id,
        name: run.test.name,
        description: run.test.description,
        flowConfigId: run.test.flowConfigId,
        accessTokenId: run.test.accessTokenId,
        questionSetId: run.test.questionSetId,
        multiStepEvaluation: run.test.multiStepEvaluation,
        webhookId: run.test.webhookId,
        createdAt: run.test.createdAt?.toISOString(),
        updatedAt: run.test.updatedAt?.toISOString(),
      } : undefined,
      questionSetId: run.questionSetId,
      status: run.status,
      results: run.results.map((r) => this.toRunResultDto(r)),
      errorMessage: run.errorMessage,
      totalQuestions: run.totalQuestions,
      completedQuestions: run.completedQuestions,
      startedAt: run.startedAt?.toISOString(),
      completedAt: run.completedAt?.toISOString(),
      isFullyEvaluated: run.isFullyEvaluated,
      evaluatedAt: run.evaluatedAt?.toISOString(),
      createdAt: run.createdAt?.toISOString(),
      updatedAt: run.updatedAt?.toISOString(),
    };
  }
}
