import { Injectable, Logger } from '@nestjs/common';
import {
  FlowConfig,
  QuestionInput,
  RunResult,
} from '@agent-eval/shared';
import { v4 as uuidv4 } from 'uuid';
import { AccessTokensService } from '../access-tokens/access-tokens.service';

@Injectable()
export class FlowService {
  private readonly logger = new Logger(FlowService.name);

  constructor(private readonly accessTokensService: AccessTokensService) {}

  async *executeFlowStream(
    config: FlowConfig,
    questions: QuestionInput[],
    userId: string,
  ): AsyncGenerator<RunResult> {
    // Resolve access token - decrypt if it's a stored token ID
    let resolvedToken = config.accessToken;
    if (config.accessTokenId) {
      try {
        resolvedToken = await this.accessTokensService.getDecryptedToken(config.accessTokenId, userId);
      } catch (error) {
        this.logger.error(`Failed to decrypt access token: ${config.accessTokenId}`, error);
        throw new Error('Failed to decrypt stored access token');
      }
    }

    const resolvedConfig = { ...config, accessToken: resolvedToken };

    // For multi-step evaluation, use a single sessionId for all questions
    const sharedSessionId = config.multiStepEvaluation ? uuidv4() : null;

    for (const question of questions) {
      try {
        const { answer, executionId } = await this.callFlowEndpoint(
          resolvedConfig,
          question.question,
          sharedSessionId,
        );

        yield {
          id: uuidv4(),
          question: question.question,
          answer,
          executionId,
          expectedAnswer: question.expectedAnswer,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        this.logger.error(
          `Failed to execute flow for question: ${question.question}`,
          error,
        );
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        yield {
          id: uuidv4(),
          question: question.question,
          answer: `Error: ${errorMessage}`,
          expectedAnswer: question.expectedAnswer,
          isError: true,
          errorMessage,
          timestamp: new Date().toISOString(),
        };
      }
    }
  }

  private async callFlowEndpoint(
    config: FlowConfig,
    question: string,
    sharedSessionId: string | null,
  ): Promise<{ answer: string; executionId?: string }> {
    const url = `${config.basePath}/api/lflow-engine/${config.flowId}/run`;

    // Use shared session ID for multi-step, or generate new one for single-step
    const sessionId = sharedSessionId || uuidv4();
    const persistAllMessages = !!sharedSessionId; // Persist messages in multi-step mode

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({
        sessionId,
        messages: [
          {
            name: 'User',
            role: 'human',
            content: [
              {
                type: 'text',
                text: question,
              },
            ],
          },
        ],
        inputVariables: {},
        persistAllMessages,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Flow API returned ${response.status}: ${response.statusText}`,
      );
    }

    const data = await response.json();
    const executionId = data.executionId;

    // Extract answer from result.messages[0].content[0].text
    if (data.result?.messages?.[0]?.content?.[0]?.text) {
      return { answer: data.result.messages[0].content[0].text, executionId };
    }

    return { answer: JSON.stringify(data), executionId };
  }
}
