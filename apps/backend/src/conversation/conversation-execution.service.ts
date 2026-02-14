import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  Conversation,
  ConversationTurn,
  ConversationStatus,
  Scenario,
  Test,
  Run,
} from '../database/entities';
import { FlowService } from '../flow/flow.service';
import {
  SimulatedUserService,
  SimulatedUserConfig,
} from './simulated-user.service';
import { SummaryService } from './summary.service';

export interface ConversationSSEEvent {
  type: string;
  data: Record<string, unknown>;
}

@Injectable()
export class ConversationExecutionService {
  private readonly logger = new Logger(ConversationExecutionService.name);

  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    private flowService: FlowService,
    private simulatedUserService: SimulatedUserService,
    private summaryService: SummaryService,
  ) {}

  async executeScenario(
    run: Run,
    scenario: Scenario,
    test: Test,
    apiKey: string,
    userId: string,
    onEvent: (event: ConversationSSEEvent) => void,
    isCanceled: () => Promise<boolean>,
  ): Promise<Conversation> {
    // Create conversation record
    const conversation = this.conversationRepository.create({
      runId: run.id,
      scenarioId: scenario.id,
      status: 'running' as ConversationStatus,
      turns: [],
      totalTurns: 0,
      startedAt: new Date(),
    });
    const savedConversation = await this.conversationRepository.save(conversation);

    onEvent({
      type: 'scenario:start',
      data: {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        conversationId: savedConversation.id,
      },
    });

    const sessionId = uuidv4();
    const turns: ConversationTurn[] = [];
    let turnIndex = 0;
    let status: ConversationStatus = 'running';
    let endReason: string | null = null;
    let goalAchieved: boolean | null = null;

    const personaSystemPrompt = scenario.persona?.systemPrompt || 'You are a helpful user.';

    // Determine provider from access token type if available
    const provider = test.simulatedUserAccessToken?.type as 'openai' | 'anthropic' | undefined;

    const simulatedUserConfig: SimulatedUserConfig = {
      model: test.simulatedUserModel || 'gpt-4o-mini',
      provider,
      modelConfig: test.simulatedUserModelConfig,
      reasoningModel: test.simulatedUserReasoningModel,
      reasoningEffort: test.simulatedUserReasoningEffort,
      personaSystemPrompt,
      goal: scenario.goal,
    };

    try {
      // Get first action from simulated user
      let action = await this.simulatedUserService.getNextAction(
        simulatedUserConfig,
        [],
        apiKey,
      );

      while (status === 'running') {
        // Check cancellation
        if (await isCanceled()) {
          status = 'error';
          endReason = 'Run was canceled';
          break;
        }

        if (action.type === 'send_message') {
          // Record user turn
          const userTurn: ConversationTurn = {
            index: turnIndex,
            role: 'user',
            message: action.text,
            timestamp: new Date().toISOString(),
          };
          turns.push(userTurn);
          turnIndex++;

          onEvent({
            type: 'turn:user',
            data: {
              scenarioId: scenario.id,
              conversationId: savedConversation.id,
              turnIndex: userTurn.index,
              message: action.text,
            },
          });

          // Send message to agent under test
          let agentResponse: string;
          try {
            const flowConfig = {
              accessTokenId: test.accessTokenId,
              basePath: test.flowConfig?.basePath || '',
              flowId: test.flowConfig?.flowId || '',
            };

            const result = await this.flowService.sendMessage(
              flowConfig,
              action.text,
              sessionId,
              userId,
            );
            agentResponse = result.answer;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Agent call failed: ${errorMsg}`);
            agentResponse = `[Agent Error: ${errorMsg}]`;
          }

          // Record agent turn
          const agentTurn: ConversationTurn = {
            index: turnIndex,
            role: 'agent',
            message: agentResponse,
            timestamp: new Date().toISOString(),
          };
          turns.push(agentTurn);
          turnIndex++;

          onEvent({
            type: 'turn:agent',
            data: {
              scenarioId: scenario.id,
              conversationId: savedConversation.id,
              turnIndex: agentTurn.index,
              message: agentResponse,
            },
          });

          // Check max turns (count user turns only)
          const userTurnCount = turns.filter((t) => t.role === 'user').length;
          if (userTurnCount >= scenario.maxTurns) {
            status = 'max_turns_reached';
            endReason = `Maximum turns reached (${scenario.maxTurns})`;
            goalAchieved = false;
            break;
          }

          // Delay between turns if configured
          if (test.delayBetweenTurns && test.delayBetweenTurns > 0) {
            await this.delay(test.delayBetweenTurns);
          }

          // Get next action from simulated user
          action = await this.simulatedUserService.getNextAction(
            simulatedUserConfig,
            turns,
            apiKey,
          );
        } else if (action.type === 'end_conversation') {
          status = action.goalAchieved ? 'goal_achieved' : 'goal_not_achieved';
          endReason = action.reason;
          goalAchieved = action.goalAchieved;
          break;
        } else if (action.type === 'error') {
          status = 'error';
          endReason = action.error;
          goalAchieved = false;
          break;
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Scenario execution failed: ${errorMsg}`, error);
      status = 'error';
      endReason = errorMsg;
      goalAchieved = false;
    }

    // Update conversation record
    savedConversation.status = status;
    savedConversation.turns = turns;
    savedConversation.totalTurns = turns.length;
    savedConversation.endReason = endReason;
    savedConversation.goalAchieved = goalAchieved;
    savedConversation.completedAt = new Date();
    const finalConversation = await this.conversationRepository.save(savedConversation);

    onEvent({
      type: 'scenario:end',
      data: {
        scenarioId: scenario.id,
        conversationId: savedConversation.id,
        status,
        goalAchieved: goalAchieved ?? false,
        reason: endReason || '',
        totalTurns: turns.length,
      },
    });

    // Generate summary (fire-and-forget, don't block)
    if (turns.length > 0) {
      this.generateAndSaveSummary(
        savedConversation.id,
        turns,
        scenario.goal,
        test.simulatedUserModel || 'gpt-4o-mini',
        apiKey,
        scenario.id,
        onEvent,
      ).catch((err) => {
        this.logger.error(`Summary generation failed for conversation ${savedConversation.id}`, err);
      });
    }

    return finalConversation;
  }

  private async generateAndSaveSummary(
    conversationId: string,
    turns: ConversationTurn[],
    goal: string,
    model: string,
    apiKey: string,
    scenarioId: string,
    onEvent: (event: ConversationSSEEvent) => void,
  ): Promise<void> {
    const summary = await this.summaryService.generateSummary(
      turns,
      goal,
      model,
      apiKey,
    );

    await this.conversationRepository.update(conversationId, { summary });

    onEvent({
      type: 'summary:generated',
      data: {
        scenarioId,
        conversationId,
        summary,
      },
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
