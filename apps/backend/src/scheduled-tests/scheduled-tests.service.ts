import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { ScheduledTest, ScheduleType } from '../database/entities/scheduled-test.entity';
import { Test } from '../database/entities/test.entity';
import { TestsService } from '../tests/tests.service';
import { RunsService } from '../runs/runs.service';
import { FlowService } from '../flow/flow.service';
import { QuestionsService } from '../questions/questions.service';
import { FlowConfig as SharedFlowConfig, QuestionInput } from '@agent-eval/shared';
import { v4 as uuidv4 } from 'uuid';

export interface CreateScheduledTestDto {
  testId: string;
  scheduleType: ScheduleType;
  scheduledAt?: string;
  cronExpression?: string;
}

@Injectable()
export class ScheduledTestsService {
  private readonly logger = new Logger(ScheduledTestsService.name);

  constructor(
    @InjectRepository(ScheduledTest)
    private scheduledTestRepository: Repository<ScheduledTest>,
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
    private testsService: TestsService,
    private runsService: RunsService,
    private flowService: FlowService,
    private questionsService: QuestionsService,
  ) {}

  async create(dto: CreateScheduledTestDto, userId: string): Promise<ScheduledTest> {
    // Verify the test exists and belongs to the user
    await this.testsService.findOne(dto.testId, userId);

    const scheduledTest = this.scheduledTestRepository.create({
      testId: dto.testId,
      scheduleType: dto.scheduleType,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      cronExpression: dto.cronExpression,
      status: 'pending',
      userId,
    });
    return this.scheduledTestRepository.save(scheduledTest);
  }

  async findAll(userId: string): Promise<ScheduledTest[]> {
    return this.scheduledTestRepository.find({
      where: { userId },
      relations: ['test'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<ScheduledTest> {
    const scheduled = await this.scheduledTestRepository.findOne({
      where: { id, userId },
      relations: ['test'],
    });
    if (!scheduled) {
      throw new NotFoundException(`Scheduled test not found: ${id}`);
    }
    return scheduled;
  }

  async update(
    id: string,
    dto: Partial<CreateScheduledTestDto>,
    userId: string
  ): Promise<ScheduledTest> {
    const scheduled = await this.findOne(id, userId);

    if (dto.testId) {
      await this.testsService.findOne(dto.testId, userId);
      scheduled.testId = dto.testId;
    }
    if (dto.scheduleType) scheduled.scheduleType = dto.scheduleType;
    if (dto.scheduledAt !== undefined) {
      scheduled.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    }
    if (dto.cronExpression !== undefined) {
      scheduled.cronExpression = dto.cronExpression;
    }

    // Reset status to pending when schedule is updated
    scheduled.status = 'pending';
    scheduled.errorMessage = null;

    return this.scheduledTestRepository.save(scheduled);
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.scheduledTestRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException(`Scheduled test not found: ${id}`);
    }
  }

  async findPendingDue(): Promise<ScheduledTest[]> {
    return this.scheduledTestRepository.find({
      where: {
        status: 'pending',
        scheduleType: 'once',
        scheduledAt: LessThanOrEqual(new Date()),
      },
      relations: ['test'],
    });
  }

  async findCronPending(): Promise<ScheduledTest[]> {
    return this.scheduledTestRepository.find({
      where: {
        status: In(['pending', 'completed']),
        scheduleType: 'cron',
      },
      relations: ['test'],
    });
  }

  private shouldCronRun(cronExpression: string, lastRunAt: Date | null): boolean {
    const now = new Date();

    if (!lastRunAt) return true;

    const timeSinceLastRun = now.getTime() - lastRunAt.getTime();
    const oneMinute = 60 * 1000;
    const oneHour = 60 * oneMinute;
    const oneDay = 24 * oneHour;

    const parts = cronExpression.trim().split(/\s+/);

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

    if (parts.length >= 5) {
      const minute = parts[0];
      const hour = parts[1];

      if (minute.startsWith('*/')) {
        const interval = parseInt(minute.slice(2), 10);
        return timeSinceLastRun >= interval * oneMinute;
      }

      if (minute === '0' && hour.startsWith('*/')) {
        const interval = parseInt(hour.slice(2), 10);
        return timeSinceLastRun >= interval * oneHour;
      }
    }

    return timeSinceLastRun >= oneMinute;
  }

  async executeScheduledTest(id: string): Promise<void> {
    const scheduled = await this.scheduledTestRepository.findOne({
      where: { id },
      relations: ['test'],
    });

    if (!scheduled) {
      throw new NotFoundException(`Scheduled test not found: ${id}`);
    }

    if (!scheduled.testId || !scheduled.test) {
      throw new NotFoundException(`Test not found for scheduled test: ${id}`);
    }

    const userId = scheduled.userId;
    const test = scheduled.test;

    // Update status to running
    scheduled.status = 'running';
    scheduled.lastRunAt = new Date();
    await this.scheduledTestRepository.save(scheduled);

    try {
      // Get the question set
      const questionSet = await this.questionsService.findOne(test.questionSetId, userId);

      // Create a run for this test
      const run = await this.runsService.create({
        testId: test.id,
        totalQuestions: questionSet.questions.length,
      }, userId);

      // Build flow config for execution
      const config: SharedFlowConfig = {
        accessToken: '',
        accessTokenId: test.accessTokenId,
        basePath: test.basePath,
        flowId: test.flowId,
        multiStepEvaluation: test.multiStepEvaluation,
      };

      // Map questions
      const questions: QuestionInput[] = questionSet.questions.map(q => ({
        id: uuidv4(),
        question: q.question,
        expectedAnswer: q.expectedAnswer,
      }));

      // Update run to running
      await this.runsService.update(run.id, {
        status: 'running',
        startedAt: new Date(),
      }, userId);

      // Execute the flow and collect results
      let completedCount = 0;
      for await (const result of this.flowService.executeFlowStream(config, questions, userId)) {
        completedCount++;
        await this.runsService.addResult(run.id, {
          id: result.id || uuidv4(),
          question: result.question,
          answer: result.answer,
          expectedAnswer: result.expectedAnswer,
          isError: result.isError,
          errorMessage: result.errorMessage,
          timestamp: new Date().toISOString(),
        }, userId);

        await this.runsService.update(run.id, {
          completedQuestions: completedCount,
        }, userId);
      }

      // Mark run as completed
      await this.runsService.update(run.id, {
        status: 'completed',
        completedAt: new Date(),
      }, userId);

      // Update scheduled test with result
      scheduled.status = 'completed';
      scheduled.resultRunId = run.id;
      scheduled.errorMessage = null;
      await this.scheduledTestRepository.save(scheduled);

      this.logger.log(`Scheduled test ${id} completed successfully, run: ${run.id}`);
    } catch (error) {
      scheduled.status = 'failed';
      scheduled.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.scheduledTestRepository.save(scheduled);

      this.logger.error(`Scheduled test ${id} failed: ${scheduled.errorMessage}`, error);
    }
  }

  async resetToPending(id: string, userId: string, newScheduledAt?: string): Promise<ScheduledTest> {
    const scheduled = await this.findOne(id, userId);

    scheduled.status = 'pending';
    scheduled.errorMessage = null;
    scheduled.resultRunId = null;
    if (newScheduledAt) {
      scheduled.scheduledAt = new Date(newScheduledAt);
    }

    return this.scheduledTestRepository.save(scheduled);
  }

  async getCronJobsDue(): Promise<ScheduledTest[]> {
    const cronJobs = await this.findCronPending();
    return cronJobs.filter(job =>
      job.cronExpression && this.shouldCronRun(job.cronExpression, job.lastRunAt)
    );
  }
}
