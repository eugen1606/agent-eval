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
  Sse,
  MessageEvent,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TestsService, PaginatedTests } from './tests.service';
import { CreateTestDto, UpdateTestDto } from './dto';
import { Test } from '../database/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FlowService } from '../flow/flow.service';
import { RunsService } from '../runs/runs.service';
import { QuestionsService } from '../questions/questions.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { FlowConfigsService } from '../flow-configs/flow-configs.service';
import { v4 as uuidv4 } from 'uuid';

@Controller('tests')
@UseGuards(JwtAuthGuard)
export class TestsController {
  constructor(
    private readonly testsService: TestsService,
    private readonly flowService: FlowService,
    private readonly runsService: RunsService,
    private readonly questionsService: QuestionsService,
    private readonly webhooksService: WebhooksService,
    private readonly flowConfigsService: FlowConfigsService,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateTestDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Test> {
    // Validate FlowConfig exists and belongs to user
    await this.flowConfigsService.findOne(dto.flowConfigId, user.userId);
    return this.testsService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('questionSetId') questionSetId?: string,
    @Query('accessTokenId') accessTokenId?: string,
    @Query('webhookId') webhookId?: string,
    @Query('multiStep') multiStep?: string,
    @Query('flowConfigId') flowConfigId?: string,
    @Query('tagIds') tagIds?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDirection') sortDirection?: string,
    @CurrentUser() user?: { userId: string; email: string },
  ): Promise<PaginatedTests> {
    return this.testsService.findAll(user!.userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      questionSetId,
      accessTokenId,
      webhookId,
      multiStep: multiStep !== undefined ? multiStep === 'true' : undefined,
      flowConfigId,
      tagIds: tagIds ? tagIds.split(',') : undefined,
      sortBy: sortBy as 'name' | 'createdAt' | 'updatedAt' | undefined,
      sortDirection: sortDirection as 'asc' | 'desc' | undefined,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Test> {
    return this.testsService.findOne(id, user.userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTestDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Test> {
    // Validate FlowConfig exists if being updated
    if (dto.flowConfigId) {
      await this.flowConfigsService.findOne(dto.flowConfigId, user.userId);
    }
    return this.testsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<void> {
    return this.testsService.delete(id, user.userId);
  }

  @Post(':id/run')
  @Sse()
  runTest(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      (async () => {
        let runId: string | null = null;
        let test: Test | null = null;

        try {
          // Get the test configuration (includes flowConfig relation)
          test = await this.testsService.findOne(id, user.userId);

          // Validate test has FlowConfig
          if (!test.flowConfigId || !test.flowConfig) {
            throw new BadRequestException('Test has no flow configuration');
          }

          if (!test.questionSetId) {
            throw new BadRequestException('Test has no question set configured');
          }

          // Get the question set
          const questionSet = await this.questionsService.findOne(test.questionSetId, user.userId);

          // Create a new run
          const run = await this.runsService.create(
            { testId: test.id, totalQuestions: questionSet.questions.length, questionSetId: test.questionSetId },
            user.userId
          );
          runId = run.id;

          // Start the run
          await this.runsService.start(run.id, user.userId);

          // Trigger run.running webhook if test has a webhook configured
          if (test.webhookId) {
            this.webhooksService.triggerWebhooks(user.userId, 'run.running', {
              runId: run.id,
              runStatus: 'running',
              testId: test.id,
              testName: test.name,
            });
          }

          // Send run start event
          subscriber.next({
            data: JSON.stringify({ type: 'run_start', runId: run.id }),
          });

          // Prepare questions with IDs
          const questions = questionSet.questions.map((q) => ({
            id: uuidv4(),
            question: q.question,
            expectedAnswer: q.expectedAnswer,
          }));

          // Build flow config from test.flowConfig
          const flowConfig = {
            accessToken: '', // Will be resolved by accessTokenId
            accessTokenId: test.accessTokenId,
            basePath: test.flowConfig.basePath || '',
            flowId: test.flowConfig.flowId,
            multiStepEvaluation: test.multiStepEvaluation,
          };

          // Stream results one by one
          for await (const result of this.flowService.executeFlowStream(
            flowConfig,
            questions,
            user.userId,
          )) {
            // Check if run was canceled before adding result
            const currentRun = await this.runsService.findOne(run.id, user.userId);
            if (currentRun.status === 'canceled') {
              // Run was canceled, stop processing
              subscriber.next({
                data: JSON.stringify({ type: 'canceled', runId: run.id }),
              });
              subscriber.complete();
              return;
            }

            // Add result to the run
            await this.runsService.addResult(run.id, result, user.userId);

            subscriber.next({
              data: JSON.stringify({ type: 'result', result }),
            });
          }

          // Check if run was canceled before completing
          const finalRun = await this.runsService.findOne(run.id, user.userId);
          if (finalRun.status === 'canceled') {
            subscriber.next({
              data: JSON.stringify({ type: 'canceled', runId: run.id }),
            });
            subscriber.complete();
            return;
          }

          // Complete the run
          const completedRun = await this.runsService.complete(run.id, user.userId);

          // Trigger run.completed webhook if test has a webhook configured
          if (test.webhookId) {
            const perfStats = this.runsService.getPerformanceStatsFromRun(completedRun);
            this.webhooksService.triggerWebhooks(user.userId, 'run.completed', {
              runId: completedRun.id,
              runStatus: 'completed',
              testId: test.id,
              testName: test.name,
              totalQuestions: completedRun.totalQuestions,
              completedQuestions: completedRun.completedQuestions,
              avgLatencyMs: perfStats.avg,
              p95LatencyMs: perfStats.p95,
              maxLatencyMs: perfStats.max,
            });
          }

          // Send completion event
          subscriber.next({
            data: JSON.stringify({ type: 'complete', runId: run.id }),
          });
          subscriber.complete();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          // Mark the run as failed if it was created
          if (runId) {
            try {
              const failedRun = await this.runsService.fail(runId, errorMessage, user.userId);

              // Trigger run.failed webhook if test has a webhook configured
              if (test?.webhookId) {
                const perfStats = this.runsService.getPerformanceStatsFromRun(failedRun);
                this.webhooksService.triggerWebhooks(user.userId, 'run.failed', {
                  runId: failedRun.id,
                  runStatus: 'failed',
                  testId: test.id,
                  testName: test.name,
                  totalQuestions: failedRun.totalQuestions,
                  completedQuestions: failedRun.completedQuestions,
                  errorMessage,
                  avgLatencyMs: perfStats.avg,
                  p95LatencyMs: perfStats.p95,
                  maxLatencyMs: perfStats.max,
                });
              }
            } catch {
              // Ignore errors when trying to mark run as failed
            }
          }

          subscriber.next({
            data: JSON.stringify({ type: 'error', error: errorMessage, runId }),
          });
          subscriber.complete();
        }
      })();
    });
  }
}
