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
import { TestsService, CreateTestDto, PaginatedTests } from './tests.service';
import { Test } from '../database/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FlowService } from '../flow/flow.service';
import { RunsService } from '../runs/runs.service';
import { QuestionsService } from '../questions/questions.service';
import { v4 as uuidv4 } from 'uuid';

@Controller('tests')
@UseGuards(JwtAuthGuard)
export class TestsController {
  constructor(
    private readonly testsService: TestsService,
    private readonly flowService: FlowService,
    private readonly runsService: RunsService,
    private readonly questionsService: QuestionsService,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateTestDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Test> {
    return this.testsService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('questionSetId') questionSetId?: string,
    @Query('multiStep') multiStep?: string,
    @Query('flowId') flowId?: string,
    @CurrentUser() user?: { userId: string; email: string },
  ): Promise<PaginatedTests> {
    return this.testsService.findAll(user!.userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      questionSetId,
      multiStep: multiStep !== undefined ? multiStep === 'true' : undefined,
      flowId,
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
    @Body() dto: Partial<CreateTestDto>,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Test> {
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

        try {
          // Get the test configuration
          const test = await this.testsService.findOne(id, user.userId);

          if (!test.questionSetId) {
            throw new BadRequestException('Test has no question set configured');
          }

          // Get the question set
          const questionSet = await this.questionsService.findOne(test.questionSetId, user.userId);

          // Create a new run
          const run = await this.runsService.create(
            { testId: test.id, totalQuestions: questionSet.questions.length },
            user.userId
          );
          runId = run.id;

          // Start the run
          await this.runsService.start(run.id, user.userId);

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

          // Build flow config from test
          const flowConfig = {
            accessToken: '', // Will be resolved by accessTokenId
            accessTokenId: test.accessTokenId,
            basePath: test.basePath,
            flowId: test.flowId,
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
          await this.runsService.complete(run.id, user.userId);

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
              await this.runsService.fail(runId, errorMessage, user.userId);
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
