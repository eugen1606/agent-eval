import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Run, RunStatus, Test } from '../database/entities';
import { WebhooksService } from '../webhooks/webhooks.service';

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
}
