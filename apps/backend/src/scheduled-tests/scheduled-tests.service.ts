import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import {
  ScheduledTest,
  ScheduleType,
  ScheduledTestStatus,
} from '../database/entities/scheduled-test.entity';
import { Test } from '../database/entities/test.entity';
import { TestsService } from '../tests/tests.service';
import { RunsService } from '../runs/runs.service';
import { FlowService } from '../flow/flow.service';
import { QuestionsService } from '../questions/questions.service';
import { ConversationRunService } from '../conversation/conversation-run.service';
import { AccessTokensService } from '../access-tokens/access-tokens.service';
import {
  FlowConfig as SharedFlowConfig,
  QuestionInput,
} from '@agent-eval/shared';
import { v4 as uuidv4 } from 'uuid';

export interface CreateScheduledTestDto {
  name: string;
  testId: string;
  scheduleType: ScheduleType;
  scheduledAt?: string;
  cronExpression?: string;
}

export type ScheduledTestsSortField = 'name' | 'scheduledAt' | 'lastRunAt' | 'status' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export interface ScheduledTestsFilterDto {
  page?: number;
  limit?: number;
  search?: string;
  testId?: string;
  status?: ScheduledTestStatus;
  sortBy?: ScheduledTestsSortField;
  sortDirection?: SortDirection;
}

export interface PaginatedScheduledTests {
  data: ScheduledTest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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
    private conversationRunService: ConversationRunService,
    private accessTokensService: AccessTokensService,
  ) {}

  async create(
    dto: CreateScheduledTestDto,
    userId: string,
  ): Promise<ScheduledTest> {
    // Verify the test exists and belongs to the user
    await this.testsService.findOne(dto.testId, userId);

    const scheduledTest = this.scheduledTestRepository.create({
      name: dto.name,
      testId: dto.testId,
      scheduleType: dto.scheduleType,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      cronExpression: dto.cronExpression,
      status: 'pending',
      userId,
    });
    return this.scheduledTestRepository.save(scheduledTest);
  }

  async findAll(
    userId: string,
    filters: ScheduledTestsFilterDto = {},
  ): Promise<PaginatedScheduledTests> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.scheduledTestRepository
      .createQueryBuilder('scheduled')
      .leftJoinAndSelect('scheduled.test', 'test')
      .where('scheduled.userId = :userId', { userId });

    // Apply testId filter
    if (filters.testId) {
      queryBuilder.andWhere('scheduled.testId = :testId', {
        testId: filters.testId,
      });
    }

    // Apply status filter
    if (filters.status) {
      queryBuilder.andWhere('scheduled.status = :status', {
        status: filters.status,
      });
    }

    // Apply search filter (search by scheduled test name or test name)
    if (filters.search) {
      queryBuilder.andWhere(
        '(scheduled.name ILIKE :search OR test.name ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Get total count before pagination
    const total = await queryBuilder.getCount();

    // Apply sorting
    const sortField = filters.sortBy || 'createdAt';
    const sortDirection = (filters.sortDirection?.toUpperCase() as 'ASC' | 'DESC') || 'DESC';
    queryBuilder.orderBy(`scheduled.${sortField}`, sortDirection);

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
    userId: string,
  ): Promise<ScheduledTest> {
    const scheduled = await this.findOne(id, userId);

    if (dto.name !== undefined) scheduled.name = dto.name;
    if (dto.testId) {
      await this.testsService.findOne(dto.testId, userId);
      scheduled.testId = dto.testId;
    }
    if (dto.scheduleType) scheduled.scheduleType = dto.scheduleType;
    if (dto.scheduledAt !== undefined) {
      scheduled.scheduledAt = dto.scheduledAt
        ? new Date(dto.scheduledAt)
        : null;
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

  /**
   * Check if a cron field matches the current value
   * Supports: *, specific number, interval
   */
  private cronFieldMatches(
    field: string,
    currentValue: number,
    maxValue: number,
  ): boolean {
    if (field === '*') return true;

    // Handle */interval
    if (field.startsWith('*/')) {
      const interval = parseInt(field.slice(2), 10);
      if (isNaN(interval) || interval <= 0) return false;
      return currentValue % interval === 0;
    }

    // Handle specific number
    const num = parseInt(field, 10);
    if (!isNaN(num)) {
      return currentValue === num;
    }

    return false;
  }

  /**
   * Check if the current time matches the cron expression
   */
  private cronMatchesNow(cronExpression: string): boolean {
    const now = new Date();
    const parts = cronExpression.trim().split(/\s+/);

    if (parts.length < 5) return false;

    const [
      minuteField,
      hourField,
      dayOfMonthField,
      monthField,
      dayOfWeekField,
    ] = parts;

    const currentMinute = now.getMinutes();
    const currentHour = now.getHours();
    const currentDayOfMonth = now.getDate();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentDayOfWeek = now.getDay(); // 0-6, Sunday = 0

    return (
      this.cronFieldMatches(minuteField, currentMinute, 59) &&
      this.cronFieldMatches(hourField, currentHour, 23) &&
      this.cronFieldMatches(dayOfMonthField, currentDayOfMonth, 31) &&
      this.cronFieldMatches(monthField, currentMonth, 12) &&
      this.cronFieldMatches(dayOfWeekField, currentDayOfWeek, 6)
    );
  }

  /**
   * Get the minimum interval in milliseconds for a cron expression
   */
  private getCronIntervalMs(cronExpression: string): number {
    const oneMinute = 60 * 1000;
    const oneHour = 60 * oneMinute;
    const oneDay = 24 * oneHour;

    const parts = cronExpression.trim().split(/\s+/);

    // Handle special expressions
    if (cronExpression === '* * * * *') return oneMinute;
    if (cronExpression === '@hourly' || cronExpression === '0 * * * *')
      return oneHour;
    if (cronExpression === '@daily' || cronExpression === '0 0 * * *')
      return oneDay;
    if (cronExpression === '@weekly' || cronExpression === '0 0 * * 0')
      return 7 * oneDay;

    if (parts.length >= 5) {
      const [minuteField, hourField] = parts;

      // */N minutes
      if (minuteField.startsWith('*/')) {
        const interval = parseInt(minuteField.slice(2), 10);
        if (!isNaN(interval) && interval > 0) return interval * oneMinute;
      }

      // 0 */N (every N hours)
      if (minuteField === '0' && hourField.startsWith('*/')) {
        const interval = parseInt(hourField.slice(2), 10);
        if (!isNaN(interval) && interval > 0) return interval * oneHour;
      }

      // Specific minute each hour (e.g., "30 * * * *")
      if (/^\d+$/.test(minuteField) && hourField === '*') {
        return oneHour;
      }

      // Specific time each day (e.g., "0 9 * * *")
      if (/^\d+$/.test(minuteField) && /^\d+$/.test(hourField)) {
        return oneDay;
      }
    }

    // Default to 1 minute for unknown patterns
    return oneMinute;
  }

  private shouldCronRun(
    cronExpression: string,
    lastRunAt: Date | null,
    createdAt: Date,
  ): boolean {
    const now = new Date();
    const intervalMs = this.getCronIntervalMs(cronExpression);

    // For first run (lastRunAt is null), check if current time matches cron schedule
    // AND if at least one interval has passed since creation
    if (!lastRunAt) {
      const timeSinceCreation = now.getTime() - createdAt.getTime();

      // Don't run if created less than the interval ago - wait for next occurrence
      // But also check if current time matches the cron pattern
      if (timeSinceCreation < intervalMs) {
        // Exception: if current time exactly matches the cron schedule, allow it
        // but only if we're in a new minute window (not re-checking same minute)
        if (this.cronMatchesNow(cronExpression)) {
          // Check if we're at the start of a matching window (within first 59 seconds)
          const secondsIntoMinute = now.getSeconds();
          if (secondsIntoMinute < 59) {
            return true;
          }
        }
        return false;
      }

      // Enough time has passed, check if current time matches cron
      return this.cronMatchesNow(cronExpression);
    }

    // For subsequent runs, check if enough time has passed AND current time matches
    const timeSinceLastRun = now.getTime() - lastRunAt.getTime();

    // Must have at least the interval time passed
    if (timeSinceLastRun < intervalMs - 30000) {
      // 30 second buffer for timing
      return false;
    }

    // Check if current time matches the cron pattern
    return this.cronMatchesNow(cronExpression);
  }

  async executeScheduledTest(id: string): Promise<void> {
    const scheduled = await this.scheduledTestRepository.findOne({
      where: { id },
      relations: ['test', 'test.flowConfig', 'test.scenarios', 'test.scenarios.persona'],
    });

    if (!scheduled) {
      throw new NotFoundException(`Scheduled test not found: ${id}`);
    }

    if (!scheduled.testId || !scheduled.test) {
      throw new NotFoundException(`Test not found for scheduled test: ${id}`);
    }

    if (!scheduled.test.flowConfigId || !scheduled.test.flowConfig) {
      throw new NotFoundException(`Flow config not found for test: ${scheduled.testId}`);
    }

    const userId = scheduled.userId;
    const test = scheduled.test;

    // Update status to running
    scheduled.status = 'running';
    scheduled.lastRunAt = new Date();
    await this.scheduledTestRepository.save(scheduled);

    try {
      // Branch based on test type
      if (test.type === 'conversation') {
        await this.executeConversationScheduledTest(test, scheduled, userId);
      } else {
        await this.executeQaScheduledTest(test, scheduled, userId);
      }
    } catch (error) {
      scheduled.status = 'failed';
      scheduled.errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.scheduledTestRepository.save(scheduled);

      this.logger.error(
        `Scheduled test ${scheduled.id} failed: ${scheduled.errorMessage}`,
        error,
      );
    }
  }

  private async executeQaScheduledTest(
    test: Test,
    scheduled: ScheduledTest,
    userId: string,
  ): Promise<void> {
    // Get the question set
    const questionSet = await this.questionsService.findOne(
      test.questionSetId,
      userId,
    );

    // Create a run for this test
    const run = await this.runsService.create(
      {
        testId: test.id,
        totalQuestions: questionSet.questions.length,
        questionSetId: test.questionSetId,
      },
      userId,
    );

    // Build flow config for execution
    const config: SharedFlowConfig = {
      accessToken: '',
      accessTokenId: test.accessTokenId,
      basePath: test.flowConfig.basePath || '',
      flowId: test.flowConfig.flowId,
      multiStepEvaluation: test.multiStepEvaluation,
    };

    // Map questions
    const questions: QuestionInput[] = questionSet.questions.map((q) => ({
      id: uuidv4(),
      question: q.question,
      expectedAnswer: q.expectedAnswer,
    }));

    // Update run to running
    await this.runsService.update(
      run.id,
      {
        status: 'running',
        startedAt: new Date(),
      },
      userId,
    );

    // Execute the flow and collect results
    let completedCount = 0;
    for await (const result of this.flowService.executeFlowStream(
      config,
      questions,
      userId,
    )) {
      completedCount++;
      await this.runsService.addResult(
        run.id,
        {
          id: result.id || uuidv4(),
          question: result.question,
          answer: result.answer,
          expectedAnswer: result.expectedAnswer,
          isError: result.isError,
          errorMessage: result.errorMessage,
          timestamp: new Date().toISOString(),
        },
        userId,
      );

      await this.runsService.update(
        run.id,
        {
          completedQuestions: completedCount,
        },
        userId,
      );
    }

    // Mark run as completed
    await this.runsService.update(
      run.id,
      {
        status: 'completed',
        completedAt: new Date(),
      },
      userId,
    );

    // Update scheduled test with result
    scheduled.status = 'completed';
    scheduled.resultRunId = run.id;
    scheduled.errorMessage = null;
    await this.scheduledTestRepository.save(scheduled);

    this.logger.log(
      `Scheduled QA test ${scheduled.id} completed successfully, run: ${run.id}`,
    );
  }

  private async executeConversationScheduledTest(
    test: Test,
    scheduled: ScheduledTest,
    userId: string,
  ): Promise<void> {
    // Validate conversation test requirements
    if (!test.scenarios || test.scenarios.length === 0) {
      throw new Error('Conversation test has no scenarios configured');
    }

    if (!test.simulatedUserModel) {
      throw new Error('Conversation test has no simulated user model configured');
    }

    // Resolve API key from stored credential
    if (!test.simulatedUserAccessTokenId) {
      throw new Error(
        'No credential configured for simulated user model. Assign a credential to the conversation test.',
      );
    }
    const apiKey = await this.accessTokensService.getDecryptedToken(
      test.simulatedUserAccessTokenId,
      userId,
    );

    // Create a run
    const run = await this.runsService.create(
      { testId: test.id, totalQuestions: 0 },
      userId,
    );

    // Start the run
    await this.runsService.start(run.id, userId);

    // Execute conversation run (non-streaming for scheduled tests)
    await new Promise<void>((resolve, reject) => {
      const observable = this.conversationRunService.executeConversationRun(
        test,
        run,
        userId,
        apiKey,
      );

      observable.subscribe({
        next: () => {
          // Events are emitted but not streamed in scheduled tests
        },
        error: (err) => reject(err),
        complete: () => resolve(),
      });
    });

    // Update scheduled test with result
    scheduled.status = 'completed';
    scheduled.resultRunId = run.id;
    scheduled.errorMessage = null;
    await this.scheduledTestRepository.save(scheduled);

    this.logger.log(
      `Scheduled conversation test ${scheduled.id} completed successfully, run: ${run.id}`,
    );
  }

  async resetToPending(
    id: string,
    userId: string,
    newScheduledAt?: string,
  ): Promise<ScheduledTest> {
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
    return cronJobs.filter(
      (job) =>
        job.cronExpression &&
        this.shouldCronRun(job.cronExpression, job.lastRunAt, job.createdAt),
    );
  }
}
