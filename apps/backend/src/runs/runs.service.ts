import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Run, RunStatus } from '../database/entities';

export interface CreateRunDto {
  testId: string;
  totalQuestions?: number;
}

export interface UpdateRunDto {
  status?: RunStatus;
  errorMessage?: string;
  completedQuestions?: number;
  completedAt?: Date;
}

export interface UpdateResultEvaluationDto {
  resultId: string;
  humanEvaluation?: 'correct' | 'incorrect' | 'partial';
  humanEvaluationDescription?: string;
  severity?: 'critical' | 'major' | 'minor';
  llmJudgeScore?: number;
  llmJudgeReasoning?: string;
}

@Injectable()
export class RunsService {
  constructor(
    @InjectRepository(Run)
    private runRepository: Repository<Run>
  ) {}

  async create(dto: CreateRunDto, userId: string): Promise<Run> {
    const run = this.runRepository.create({
      testId: dto.testId,
      totalQuestions: dto.totalQuestions ?? 0,
      status: 'pending',
      results: [],
      userId,
    });
    return this.runRepository.save(run);
  }

  async findAll(userId: string, testId?: string): Promise<Run[]> {
    const where: { userId: string; testId?: string } = { userId };
    if (testId) {
      where.testId = testId;
    }
    return this.runRepository.find({
      where,
      relations: ['test'],
      order: { createdAt: 'DESC' },
    });
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
    if (dto.completedQuestions !== undefined) run.completedQuestions = dto.completedQuestions;
    if (dto.completedAt !== undefined) run.completedAt = dto.completedAt;

    return this.runRepository.save(run);
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

  async addResult(id: string, result: Run['results'][0], userId: string): Promise<Run> {
    const run = await this.findOne(id, userId);
    run.results.push(result);
    run.completedQuestions = run.results.length;
    return this.runRepository.save(run);
  }

  async updateResultEvaluation(
    id: string,
    dto: UpdateResultEvaluationDto,
    userId: string
  ): Promise<Run> {
    const run = await this.findOne(id, userId);

    const resultIndex = run.results.findIndex(r => r.id === dto.resultId);
    if (resultIndex === -1) {
      throw new NotFoundException(`Result not found: ${dto.resultId}`);
    }

    const result = run.results[resultIndex];
    if (dto.humanEvaluation !== undefined) result.humanEvaluation = dto.humanEvaluation;
    if (dto.humanEvaluationDescription !== undefined) result.humanEvaluationDescription = dto.humanEvaluationDescription;
    if (dto.severity !== undefined) result.severity = dto.severity;
    if (dto.llmJudgeScore !== undefined) result.llmJudgeScore = dto.llmJudgeScore;
    if (dto.llmJudgeReasoning !== undefined) result.llmJudgeReasoning = dto.llmJudgeReasoning;

    run.results[resultIndex] = result;
    return this.runRepository.save(run);
  }

  async bulkUpdateResultEvaluations(
    id: string,
    updates: UpdateResultEvaluationDto[],
    userId: string
  ): Promise<Run> {
    const run = await this.findOne(id, userId);

    for (const dto of updates) {
      const resultIndex = run.results.findIndex(r => r.id === dto.resultId);
      if (resultIndex === -1) continue;

      const result = run.results[resultIndex];
      if (dto.humanEvaluation !== undefined) result.humanEvaluation = dto.humanEvaluation;
      if (dto.humanEvaluationDescription !== undefined) result.humanEvaluationDescription = dto.humanEvaluationDescription;
      if (dto.severity !== undefined) result.severity = dto.severity;
      if (dto.llmJudgeScore !== undefined) result.llmJudgeScore = dto.llmJudgeScore;
      if (dto.llmJudgeReasoning !== undefined) result.llmJudgeReasoning = dto.llmJudgeReasoning;

      run.results[resultIndex] = result;
    }

    return this.runRepository.save(run);
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.runRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException(`Run not found: ${id}`);
    }
  }

  async getStats(id: string, userId: string): Promise<{
    total: number;
    evaluated: number;
    correct: number;
    partial: number;
    incorrect: number;
    errors: number;
    accuracy: number | null;
  }> {
    const run = await this.findOne(id, userId);

    const total = run.results.length;
    const errors = run.results.filter(r => r.isError).length;
    const evaluated = run.results.filter(r => r.humanEvaluation && !r.isError).length;
    const correct = run.results.filter(r => r.humanEvaluation === 'correct').length;
    const partial = run.results.filter(r => r.humanEvaluation === 'partial').length;
    const incorrect = run.results.filter(r => r.humanEvaluation === 'incorrect').length;

    const evaluatable = total - errors;
    const accuracy = evaluatable > 0 && evaluated === evaluatable
      ? Math.round((correct + partial * 0.5) / evaluatable * 100)
      : null;

    return { total, evaluated, correct, partial, incorrect, errors, accuracy };
  }
}
