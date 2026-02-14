import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, Subscriber } from 'rxjs';
import {
  Conversation,
  Test,
  Run,
  Scenario,
} from '../database/entities';
import { RunsService } from '../runs/runs.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import {
  ConversationExecutionService,
  ConversationSSEEvent,
} from './conversation-execution.service';
import { ConversationRunStats } from '@agent-eval/shared';

interface MessageEvent {
  data: string;
}

const MAX_PARALLEL_SCENARIOS = 3;

@Injectable()
export class ConversationRunService {
  private readonly logger = new Logger(ConversationRunService.name);

  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Run)
    private runRepository: Repository<Run>,
    private runsService: RunsService,
    private webhooksService: WebhooksService,
    private conversationExecutionService: ConversationExecutionService,
  ) {}

  executeConversationRun(
    test: Test,
    run: Run,
    userId: string,
    apiKey: string,
  ): Observable<MessageEvent> {
    return new Observable((subscriber: Subscriber<MessageEvent>) => {
      this.runConversations(test, run, userId, apiKey, subscriber)
        .catch((error) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          subscriber.next({
            data: JSON.stringify({ type: 'run:error', errorMessage }),
          });
        })
        .finally(() => {
          subscriber.complete();
        });
    });
  }

  private async runConversations(
    test: Test,
    run: Run,
    userId: string,
    apiKey: string,
    subscriber: Subscriber<MessageEvent>,
  ): Promise<void> {
    const scenarios = test.scenarios?.sort((a, b) => a.orderIndex - b.orderIndex) || [];

    if (scenarios.length === 0) {
      await this.runsService.fail(run.id, 'No scenarios configured', userId);
      subscriber.next({
        data: JSON.stringify({ type: 'run:error', errorMessage: 'No scenarios configured' }),
      });
      return;
    }

    // Update run with scenario count
    await this.runRepository.update(run.id, {
      totalScenarios: scenarios.length,
      completedScenarios: 0,
    });

    subscriber.next({
      data: JSON.stringify({
        type: 'run_start',
        runId: run.id,
        totalScenarios: scenarios.length,
      }),
    });

    const emitEvent = (event: ConversationSSEEvent) => {
      subscriber.next({
        data: JSON.stringify({ type: event.type, ...event.data }),
      });
    };

    const isCanceled = async (): Promise<boolean> => {
      try {
        const currentRun = await this.runsService.findOne(run.id, userId);
        return currentRun.status === 'canceled';
      } catch {
        return false;
      }
    };

    try {
      if (test.executionMode === 'parallel') {
        await this.executeParallel(
          scenarios,
          run,
          test,
          userId,
          apiKey,
          emitEvent,
          isCanceled,
        );
      } else {
        await this.executeSequential(
          scenarios,
          run,
          test,
          userId,
          apiKey,
          emitEvent,
          isCanceled,
        );
      }

      // Check if run was canceled
      const finalRun = await this.runsService.findOne(run.id, userId);
      if (finalRun.status === 'canceled') {
        subscriber.next({
          data: JSON.stringify({ type: 'canceled', runId: run.id }),
        });
        return;
      }

      // Complete the run
      await this.runsService.complete(run.id, userId);

      // Calculate and emit stats
      const stats = await this.getConversationStats(run.id);
      subscriber.next({
        data: JSON.stringify({ type: 'run:complete', ...stats }),
      });

      subscriber.next({
        data: JSON.stringify({ type: 'complete', runId: run.id }),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Conversation run failed: ${errorMessage}`, error);
      await this.runsService.fail(run.id, errorMessage, userId).catch((e) => {
        this.logger.error(`Failed to mark run as failed: ${e}`);
      });
      subscriber.next({
        data: JSON.stringify({ type: 'run:error', errorMessage }),
      });
    }
  }

  private async executeSequential(
    scenarios: Scenario[],
    run: Run,
    test: Test,
    userId: string,
    apiKey: string,
    emitEvent: (event: ConversationSSEEvent) => void,
    isCanceled: () => Promise<boolean>,
  ): Promise<void> {
    for (const scenario of scenarios) {
      if (await isCanceled()) break;

      try {
        const conversation = await this.conversationExecutionService.executeScenario(
          run,
          scenario,
          test,
          apiKey,
          userId,
          emitEvent,
          isCanceled,
        );

        // Trigger conversation.completed webhook
        this.triggerConversationCompletedWebhook(test, run, conversation, scenario, userId);
      } catch (error) {
        this.logger.error(
          `Scenario ${scenario.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        // Single scenario failure doesn't fail the whole run
      }

      // Update completed count
      await this.runRepository.increment(
        { id: run.id },
        'completedScenarios',
        1,
      );
    }
  }

  private async executeParallel(
    scenarios: Scenario[],
    run: Run,
    test: Test,
    userId: string,
    apiKey: string,
    emitEvent: (event: ConversationSSEEvent) => void,
    isCanceled: () => Promise<boolean>,
  ): Promise<void> {
    // Execute with controlled concurrency
    const chunks = this.chunkArray(scenarios, MAX_PARALLEL_SCENARIOS);

    for (const chunk of chunks) {
      if (await isCanceled()) break;

      const promises = chunk.map(async (scenario) => {
        try {
          const conversation = await this.conversationExecutionService.executeScenario(
            run,
            scenario,
            test,
            apiKey,
            userId,
            emitEvent,
            isCanceled,
          );

          // Trigger conversation.completed webhook
          this.triggerConversationCompletedWebhook(test, run, conversation, scenario, userId);
        } catch (error) {
          this.logger.error(
            `Scenario ${scenario.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }

        await this.runRepository.increment(
          { id: run.id },
          'completedScenarios',
          1,
        );
      });

      await Promise.all(promises);
    }
  }

  private triggerConversationCompletedWebhook(
    test: Test,
    run: Run,
    conversation: Conversation,
    scenario: Scenario,
    userId: string,
  ): void {
    if (!test.webhookId) return;

    this.webhooksService.triggerWebhooks(userId, 'conversation.completed', {
      runId: run.id,
      testId: test.id,
      testName: test.name,
      conversationId: conversation.id,
      conversationStatus: conversation.status,
      goalAchieved: conversation.goalAchieved ?? undefined,
      totalTurns: conversation.totalTurns,
      scenarioName: scenario.name,
      personaName: scenario.persona?.name,
    }).catch((err) => {
      this.logger.error(`Failed to trigger conversation.completed webhook: ${err}`);
    });
  }

  async getConversationStats(runId: string): Promise<ConversationRunStats> {
    const conversations = await this.conversationRepository.find({
      where: { runId },
    });

    const completedConversations = conversations.filter(
      (c) => c.status !== 'running',
    );

    const totalTurns = conversations.reduce((sum, c) => sum + c.totalTurns, 0);
    const avgTurns = conversations.length > 0
      ? Math.round(totalTurns / conversations.length)
      : 0;

    return {
      totalScenarios: conversations.length,
      completedScenarios: completedConversations.length,
      goalAchievedCount: conversations.filter(
        (c) => c.status === 'goal_achieved',
      ).length,
      goalNotAchievedCount: conversations.filter(
        (c) => c.status === 'goal_not_achieved',
      ).length,
      maxTurnsReachedCount: conversations.filter(
        (c) => c.status === 'max_turns_reached',
      ).length,
      errorCount: conversations.filter((c) => c.status === 'error').length,
      averageTurns: avgTurns,
      evaluations: {
        good: conversations.filter((c) => c.humanEvaluation === 'good').length,
        acceptable: conversations.filter(
          (c) => c.humanEvaluation === 'acceptable',
        ).length,
        poor: conversations.filter((c) => c.humanEvaluation === 'poor').length,
        unevaluated: conversations.filter(
          (c) => !c.humanEvaluation,
        ).length,
      },
    };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
