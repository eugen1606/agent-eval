import { Injectable, Logger } from '@nestjs/common';
import {
  FlowConfig,
  QuestionInput,
  EvaluationResult,
} from '@agent-eval/shared';
import { v4 as uuidv4 } from 'uuid';
import { AccessTokensService } from '../access-tokens/access-tokens.service';

@Injectable()
export class FlowService {
  private readonly logger = new Logger(FlowService.name);

  constructor(private readonly accessTokensService: AccessTokensService) {}

  async executeFlow(
    config: FlowConfig,
    questions: QuestionInput[],
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    // Resolve access token - decrypt if it's a stored token ID
    let resolvedToken = config.accessToken;
    if (config.accessTokenId) {
      try {
        resolvedToken = await this.accessTokensService.getDecryptedToken(config.accessTokenId);
      } catch (error) {
        this.logger.error(`Failed to decrypt access token: ${config.accessTokenId}`, error);
        throw new Error('Failed to decrypt stored access token');
      }
    }

    const resolvedConfig = { ...config, accessToken: resolvedToken };

    for (const question of questions) {
      try {
        const { answer, executionId } = await this.callFlowEndpoint(resolvedConfig, question.question);

        results.push({
          id: uuidv4(),
          question: question.question,
          answer,
          executionId,
          expectedAnswer: question.expectedAnswer,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.logger.error(
          `Failed to execute flow for question: ${question.question}`,
          error,
        );
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          id: uuidv4(),
          question: question.question,
          answer: `Error: ${errorMessage}`,
          expectedAnswer: question.expectedAnswer,
          isError: true,
          errorMessage,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  private async callFlowEndpoint(
    config: FlowConfig,
    question: string,
  ): Promise<{ answer: string; executionId?: string }> {
    const url = `${config.basePath}/api/lflow-engine/${config.flowId}/run`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({
        sessionId: uuidv4(),
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
        persistAllMessages: false,
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
