import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { ScheduledEvaluation, ScheduleType } from '../database/entities/scheduled-evaluation.entity';
import { FlowService } from '../flow/flow.service';
import { QuestionsService } from '../questions/questions.service';
import { FlowConfigsService } from '../flow-configs/flow-configs.service';
import { EvaluationsService } from '../evaluations/evaluations.service';
import { FlowConfig as SharedFlowConfig, EvaluationResult, QuestionInput } from '@agent-eval/shared';
import { v4 as uuidv4 } from 'uuid';
import { CronExpression } from '@nestjs/schedule';

export interface CreateScheduledEvaluationDto {
  name: string;
  description?: string;
  accessTokenId: string;
  flowConfigId: string;
  questionSetId: string;
  scheduleType?: ScheduleType;
  scheduledAt?: string; // ISO date string for one-time
  cronExpression?: string; // Cron expression for recurring
  multiStepEvaluation?: boolean;
}

@Injectable()
export class ScheduledEvaluationsService {
  private readonly logger = new Logger(ScheduledEvaluationsService.name);

  constructor(
    @InjectRepository(ScheduledEvaluation)
    private scheduledEvaluationRepository: Repository<ScheduledEvaluation>,
    private flowService: FlowService,
    private questionsService: QuestionsService,
    private flowConfigsService: FlowConfigsService,
    private evaluationsService: EvaluationsService
  ) {}

  async create(dto: CreateScheduledEvaluationDto, userId: string): Promise<ScheduledEvaluation> {
    const scheduleType = dto.scheduleType || 'once';
    const scheduledEvaluation = this.scheduledEvaluationRepository.create({
      name: dto.name,
      description: dto.description,
      accessTokenId: dto.accessTokenId,
      flowConfigId: dto.flowConfigId,
      questionSetId: dto.questionSetId,
      scheduleType,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      cronExpression: dto.cronExpression,
      multiStepEvaluation: dto.multiStepEvaluation || false,
      status: 'pending',
      userId,
    });
    return this.scheduledEvaluationRepository.save(scheduledEvaluation);
  }

  async findAll(userId: string): Promise<ScheduledEvaluation[]> {
    return this.scheduledEvaluationRepository.find({
      where: { userId },
      order: { scheduledAt: 'ASC' },
    });
  }

  async findOne(id: string, userId: string): Promise<ScheduledEvaluation> {
    const scheduledEvaluation = await this.scheduledEvaluationRepository.findOne({
      where: { id, userId },
    });
    if (!scheduledEvaluation) {
      throw new NotFoundException(`Scheduled evaluation not found: ${id}`);
    }
    return scheduledEvaluation;
  }

  async update(
    id: string,
    dto: Partial<CreateScheduledEvaluationDto>,
    userId: string
  ): Promise<ScheduledEvaluation> {
    const scheduledEvaluation = await this.findOne(id, userId);

    if (dto.name) scheduledEvaluation.name = dto.name;
    if (dto.description !== undefined) scheduledEvaluation.description = dto.description;
    if (dto.accessTokenId) scheduledEvaluation.accessTokenId = dto.accessTokenId;
    if (dto.flowConfigId) scheduledEvaluation.flowConfigId = dto.flowConfigId;
    if (dto.questionSetId) scheduledEvaluation.questionSetId = dto.questionSetId;
    if (dto.scheduleType) scheduledEvaluation.scheduleType = dto.scheduleType;
    if (dto.scheduledAt !== undefined) {
      scheduledEvaluation.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    }
    if (dto.cronExpression !== undefined) {
      scheduledEvaluation.cronExpression = dto.cronExpression;
    }
    if (dto.multiStepEvaluation !== undefined) {
      scheduledEvaluation.multiStepEvaluation = dto.multiStepEvaluation;
    }

    return this.scheduledEvaluationRepository.save(scheduledEvaluation);
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.scheduledEvaluationRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException(`Scheduled evaluation not found: ${id}`);
    }
  }

  // Find pending one-time evaluations that are due
  async findPendingDue(): Promise<ScheduledEvaluation[]> {
    return this.scheduledEvaluationRepository.find({
      where: {
        status: 'pending',
        scheduleType: 'once',
        scheduledAt: LessThanOrEqual(new Date()),
      },
    });
  }

  // Find cron-based evaluations that are pending
  async findCronPending(): Promise<ScheduledEvaluation[]> {
    return this.scheduledEvaluationRepository.find({
      where: {
        status: In(['pending', 'completed']), // Cron jobs run repeatedly
        scheduleType: 'cron',
      },
    });
  }

  // Check if cron expression matches current time
  private shouldCronRun(cronExpression: string, lastRunAt: Date | null): boolean {
    // Simple cron matching - checks if enough time has passed based on common patterns
    const now = new Date();

    if (!lastRunAt) return true; // Never run before

    const timeSinceLastRun = now.getTime() - lastRunAt.getTime();
    const oneMinute = 60 * 1000;
    const oneHour = 60 * oneMinute;
    const oneDay = 24 * oneHour;

    // Parse common cron patterns
    const parts = cronExpression.trim().split(/\s+/);

    // Handle named expressions
    if (cronExpression === '* * * * *') {
      return timeSinceLastRun >= oneMinute;
    }
    if (cronExpression === '0 * * * *' || cronExpression === '@hourly') {
      return timeSinceLastRun >= oneHour;
    }
    if (cronExpression === '0 0 * * *' || cronExpression === '@daily') {
      return timeSinceLastRun >= oneDay;
    }
    if (cronExpression === '0 0 * * 0' || cronExpression === '@weekly') {
      return timeSinceLastRun >= 7 * oneDay;
    }

    // For custom expressions, check minute field
    if (parts.length >= 5) {
      const minute = parts[0];
      const hour = parts[1];

      // */5 means every 5 minutes
      if (minute.startsWith('*/')) {
        const interval = parseInt(minute.slice(2), 10);
        return timeSinceLastRun >= interval * oneMinute;
      }

      // 0 */2 means every 2 hours
      if (minute === '0' && hour.startsWith('*/')) {
        const interval = parseInt(hour.slice(2), 10);
        return timeSinceLastRun >= interval * oneHour;
      }
    }

    // Default: at least 1 minute between runs
    return timeSinceLastRun >= oneMinute;
  }

  // Execute a scheduled evaluation
  async executeScheduledEvaluation(id: string): Promise<void> {
    const scheduled = await this.scheduledEvaluationRepository.findOne({
      where: { id },
    });

    if (!scheduled) {
      throw new NotFoundException(`Scheduled evaluation not found: ${id}`);
    }

    const userId = scheduled.userId;

    // Update status to running
    scheduled.status = 'running';
    scheduled.lastRunAt = new Date();
    await this.scheduledEvaluationRepository.save(scheduled);

    try {
      // Get the flow config
      const flowConfig = await this.flowConfigsService.findOne(scheduled.flowConfigId, userId);

      // Get the question set
      const questionSet = await this.questionsService.findOne(scheduled.questionSetId, userId);

      // Build flow config for execution
      const config: SharedFlowConfig = {
        accessToken: '', // Will be resolved by accessTokenId
        accessTokenId: scheduled.accessTokenId,
        basePath: flowConfig.basePath || '',
        flowId: flowConfig.flowId,
        multiStepEvaluation: scheduled.multiStepEvaluation,
      };

      // Map questions to include IDs
      const questions: QuestionInput[] = questionSet.questions.map(q => ({
        id: uuidv4(),
        question: q.question,
        expectedAnswer: q.expectedAnswer,
      }));

      // Execute the flow and collect results
      const results: EvaluationResult[] = [];
      for await (const result of this.flowService.executeFlowStream(config, questions, userId)) {
        results.push(result);
      }

      // Create an evaluation with the results
      const evaluation = await this.evaluationsService.create(
        {
          name: `[Scheduled] ${scheduled.name}`,
          finalOutput: {
            config,
            results,
            savedAt: new Date().toISOString(),
            scheduledEvaluationId: scheduled.id,
          },
          flowId: flowConfig.flowId,
          description: scheduled.description || `Scheduled evaluation executed at ${new Date().toISOString()}`,
        },
        userId
      );

      // Update scheduled evaluation with result
      scheduled.status = 'completed';
      scheduled.resultEvaluationId = evaluation.id;
      scheduled.errorMessage = null;
      await this.scheduledEvaluationRepository.save(scheduled);

      this.logger.log(`Scheduled evaluation ${id} completed successfully`);
    } catch (error) {
      // Update status to failed
      scheduled.status = 'failed';
      scheduled.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.scheduledEvaluationRepository.save(scheduled);

      this.logger.error(`Scheduled evaluation ${id} failed: ${scheduled.errorMessage}`, error);
    }
  }

  // Reset a failed or completed evaluation to pending for re-execution
  async resetToPending(id: string, userId: string, newScheduledAt?: string): Promise<ScheduledEvaluation> {
    const scheduled = await this.findOne(id, userId);

    scheduled.status = 'pending';
    scheduled.errorMessage = null;
    scheduled.resultEvaluationId = null;
    if (newScheduledAt) {
      scheduled.scheduledAt = new Date(newScheduledAt);
    }

    return this.scheduledEvaluationRepository.save(scheduled);
  }

  // Get cron jobs that should run now
  async getCronJobsDue(): Promise<ScheduledEvaluation[]> {
    const cronJobs = await this.findCronPending();
    return cronJobs.filter(job =>
      job.cronExpression && this.shouldCronRun(job.cronExpression, job.lastRunAt)
    );
  }
}
