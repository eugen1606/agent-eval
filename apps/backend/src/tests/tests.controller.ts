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
  Logger,
  MessageEvent,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { TestsService, PaginatedTests } from './tests.service';
import { ScenariosService } from './scenarios.service';
import { CreateTestDto, UpdateTestDto, CreateScenarioDto, UpdateScenarioDto, ReorderScenariosDto } from './dto';
import { Test, Scenario } from '../database/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FlowService } from '../flow/flow.service';
import { RunsService } from '../runs/runs.service';
import { QuestionsService } from '../questions/questions.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { FlowConfigsService } from '../flow-configs/flow-configs.service';
import { EvaluatorsService } from '../evaluators/evaluators.service';
import { EvaluationService } from '../evaluation/evaluation.service';
import { AccessTokensService } from '../access-tokens/access-tokens.service';
import { ConversationRunService } from '../conversation/conversation-run.service';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('tests')
@Controller('tests')
@UseGuards(JwtAuthGuard)
export class TestsController {
  private readonly logger = new Logger(TestsController.name);

  constructor(
    private readonly testsService: TestsService,
    private readonly scenariosService: ScenariosService,
    private readonly flowService: FlowService,
    private readonly runsService: RunsService,
    private readonly questionsService: QuestionsService,
    private readonly webhooksService: WebhooksService,
    private readonly flowConfigsService: FlowConfigsService,
    private readonly evaluatorsService: EvaluatorsService,
    private readonly evaluationService: EvaluationService,
    private readonly accessTokensService: AccessTokensService,
    private readonly conversationRunService: ConversationRunService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new test configuration' })
  @ApiResponse({ status: 201, description: 'Test created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(
    @Body() dto: CreateTestDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Test> {
    // Validate FlowConfig exists and belongs to user
    await this.flowConfigsService.findOne(dto.flowConfigId, user.userId);
    return this.testsService.create(dto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all tests with pagination and filtering' })
  @ApiResponse({ status: 200, description: 'Paginated list of tests' })
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
    @Query('type') type?: string,
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
      type: type as 'qa' | 'conversation' | undefined,
      sortBy: sortBy as 'name' | 'createdAt' | 'updatedAt' | undefined,
      sortDirection: sortDirection as 'asc' | 'desc' | undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a test by ID' })
  @ApiResponse({ status: 200, description: 'Test found' })
  @ApiResponse({ status: 404, description: 'Test not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Test> {
    return this.testsService.findOne(id, user.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a test configuration' })
  @ApiResponse({ status: 200, description: 'Test updated' })
  @ApiResponse({ status: 404, description: 'Test not found' })
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
  @ApiOperation({ summary: 'Delete a test' })
  @ApiResponse({ status: 200, description: 'Test deleted' })
  @ApiResponse({ status: 404, description: 'Test not found' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<void> {
    return this.testsService.delete(id, user.userId);
  }

  // --- Scenario sub-endpoints ---

  @Get(':id/scenarios')
  @ApiOperation({ summary: 'List scenarios for a test' })
  @ApiResponse({ status: 200, description: 'List of scenarios' })
  async getScenarios(
    @Param('id') testId: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Scenario[]> {
    return this.scenariosService.findAll(testId, user.userId);
  }

  @Post(':id/scenarios')
  @ApiOperation({ summary: 'Add a scenario to a conversation test' })
  @ApiResponse({ status: 201, description: 'Scenario created' })
  @ApiResponse({ status: 400, description: 'Test is not a conversation type' })
  async createScenario(
    @Param('id') testId: string,
    @Body() dto: CreateScenarioDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Scenario> {
    return this.scenariosService.create(testId, dto, user.userId);
  }

  @Put(':id/scenarios/reorder')
  @ApiOperation({ summary: 'Reorder scenarios' })
  @ApiResponse({ status: 200, description: 'Scenarios reordered' })
  async reorderScenarios(
    @Param('id') testId: string,
    @Body() dto: ReorderScenariosDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<void> {
    return this.scenariosService.reorder(testId, dto.scenarioIds, user.userId);
  }

  @Put(':id/scenarios/:scenarioId')
  @ApiOperation({ summary: 'Update a scenario' })
  @ApiResponse({ status: 200, description: 'Scenario updated' })
  @ApiResponse({ status: 404, description: 'Scenario not found' })
  async updateScenario(
    @Param('id') testId: string,
    @Param('scenarioId') scenarioId: string,
    @Body() dto: UpdateScenarioDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Scenario> {
    return this.scenariosService.update(testId, scenarioId, dto, user.userId);
  }

  @Delete(':id/scenarios/:scenarioId')
  @ApiOperation({ summary: 'Delete a scenario' })
  @ApiResponse({ status: 200, description: 'Scenario deleted' })
  @ApiResponse({ status: 404, description: 'Scenario not found' })
  async deleteScenario(
    @Param('id') testId: string,
    @Param('scenarioId') scenarioId: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<void> {
    return this.scenariosService.delete(testId, scenarioId, user.userId);
  }

  @Post(':id/run')
  @ApiOperation({ summary: 'Execute a test and stream results via SSE' })
  @ApiResponse({ status: 200, description: 'SSE stream of run results' })
  @ApiResponse({ status: 400, description: 'Test missing flow config or question set' })
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

          // Branch based on test type
          if (test.type === 'conversation') {
            await this.runConversationTest(test, user, subscriber);
            return;
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

          // Fire-and-forget auto AI evaluation if evaluator is configured
          if (test.evaluatorId) {
            this.autoEvaluate(completedRun.id, test.evaluatorId, user.userId).catch((err) => {
              this.logger.error(`Auto-evaluation failed for run ${completedRun.id}`, err);
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

  private async runConversationTest(
    test: Test,
    user: { userId: string; email: string },
    subscriber: import('rxjs').Subscriber<MessageEvent>,
  ): Promise<void> {
    let runId: string | null = null;

    try {
      // Validate conversation test requirements
      if (!test.scenarios || test.scenarios.length === 0) {
        throw new BadRequestException('Conversation test has no scenarios configured');
      }

      if (!test.simulatedUserModel) {
        throw new BadRequestException('Conversation test has no simulated user model configured');
      }

      // Resolve API key for the simulated user model
      let apiKey: string | null = null;
      if (!test.simulatedUserAccessTokenId) {
        throw new BadRequestException(
          'No credential configured for simulated user model. Assign a credential to the conversation test.',
        );
      }
      try {
        apiKey = await this.accessTokensService.getDecryptedToken(
          test.simulatedUserAccessTokenId,
          user.userId,
        );
      } catch {
        throw new BadRequestException(
          'Failed to decrypt simulated user credential. The credential may have been deleted.',
        );
      }

      // Create a new run
      const run = await this.runsService.create(
        { testId: test.id, totalQuestions: 0 },
        user.userId,
      );
      runId = run.id;

      // Start the run
      await this.runsService.start(run.id, user.userId);

      // Trigger run.running webhook
      if (test.webhookId) {
        this.webhooksService.triggerWebhooks(user.userId, 'run.running', {
          runId: run.id,
          runStatus: 'running',
          testId: test.id,
          testName: test.name,
        });
      }

      // Execute conversation run (returns Observable, we subscribe and forward)
      const conversationObservable = this.conversationRunService.executeConversationRun(
        test,
        run,
        user.userId,
        apiKey,
      );

      conversationObservable.subscribe({
        next: (event) => subscriber.next(event),
        error: (err) => {
          subscriber.next({
            data: JSON.stringify({
              type: 'error',
              error: err instanceof Error ? err.message : 'Unknown error',
              runId,
            }),
          });
          subscriber.complete();
        },
        complete: () => {
          // Trigger completed webhook
          if (test.webhookId) {
            this.webhooksService.triggerWebhooks(user.userId, 'run.completed', {
              runId: run.id,
              runStatus: 'completed',
              testId: test.id,
              testName: test.name,
            });
          }
          subscriber.complete();
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (runId) {
        try {
          await this.runsService.fail(runId, errorMessage, user.userId);
          if (test.webhookId) {
            this.webhooksService.triggerWebhooks(user.userId, 'run.failed', {
              runId,
              runStatus: 'failed',
              testId: test.id,
              testName: test.name,
              errorMessage,
            });
          }
        } catch {
          // Ignore
        }
      }

      subscriber.next({
        data: JSON.stringify({ type: 'error', error: errorMessage, runId }),
      });
      subscriber.complete();
    }
  }

  private async autoEvaluate(runId: string, evaluatorId: string, userId: string): Promise<void> {
    try {
      const run = await this.runsService.findOne(runId, userId);
      const evaluator = await this.evaluatorsService.findOneEntity(evaluatorId, userId);
      if (!evaluator.accessTokenId) {
        this.logger.warn(`Auto-evaluation skipped: evaluator ${evaluatorId} has no credential`);
        return;
      }

      const apiKey = await this.accessTokensService.getDecryptedToken(evaluator.accessTokenId, userId);
      const tokenInfo = await this.accessTokensService.findOne(evaluator.accessTokenId, userId);
      const provider = tokenInfo.type as 'openai' | 'anthropic';

      const results = run.results.filter((r) => !r.isError);
      if (results.length === 0) return;

      await this.runsService.startEvaluation(runId, results.length, userId);

      for (const result of results) {
        try {
          const llmResult = await this.evaluationService.evaluateWithLLM(
            result.question,
            result.answer,
            result.expectedAnswer,
            { apiKey, provider, model: evaluator.model, systemPrompt: evaluator.systemPrompt, reasoningModel: evaluator.reasoningModel, reasoningEffort: evaluator.reasoningEffort },
          );

          await this.runsService.updateResultEvaluation(runId, {
            resultId: result.id,
            llmJudgeScore: llmResult.score,
            llmJudgeReasoning: llmResult.reasoning,
          }, userId);
        } catch (error) {
          this.logger.error(`Auto-evaluation failed for result ${result.id}`, error);
        }
      }
    } finally {
      await this.runsService.completeEvaluation(runId, userId).catch((err) => {
        this.logger.error(`Failed to complete auto-evaluation for run ${runId}`, err);
      });
    }
  }
}
