import { Injectable, Logger } from '@nestjs/common';
import {
  FlowConfig,
  QuestionInput,
  RunResult,
} from '@agent-eval/shared';
import { v4 as uuidv4 } from 'uuid';
import { AccessTokensService } from '../access-tokens/access-tokens.service';
import { UrlValidationService } from '../common/validators/url-validation.service';
import { ProxyFetchService } from '../common/proxy-fetch';

@Injectable()
export class FlowService {
  private readonly logger = new Logger(FlowService.name);

  constructor(
    private readonly accessTokensService: AccessTokensService,
    private readonly urlValidationService: UrlValidationService,
    private readonly proxyFetchService: ProxyFetchService,
  ) {}

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
      const sessionId = sharedSessionId || uuidv4();
      const startTime = Date.now();
      try {
        const { answer, executionId } = await this.callFlowEndpoint(
          resolvedConfig,
          question.question,
          sessionId,
          question.inputVariables,
        );
        const executionTimeMs = Date.now() - startTime;

        yield {
          id: uuidv4(),
          question: question.question,
          answer,
          executionId,
          sessionId,
          executionTimeMs,
          expectedAnswer: question.expectedAnswer,
          inputVariables: question.inputVariables,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        const executionTimeMs = Date.now() - startTime;
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
          inputVariables: question.inputVariables,
          sessionId,
          executionTimeMs,
          isError: true,
          errorMessage,
          timestamp: new Date().toISOString(),
        };
      }
    }
  }

  /**
   * Send a single message to the agent and get a response.
   * Used by conversation execution for turn-by-turn communication.
   */
  async sendMessage(
    config: { accessTokenId?: string; basePath: string; flowId: string },
    message: string,
    sessionId: string,
    userId: string,
  ): Promise<{ answer: string; executionId?: string }> {
    let resolvedToken = '';
    if (config.accessTokenId) {
      resolvedToken = await this.accessTokensService.getDecryptedToken(config.accessTokenId, userId);
    }

    const flowConfig: FlowConfig = {
      accessToken: resolvedToken,
      accessTokenId: config.accessTokenId,
      basePath: config.basePath,
      flowId: config.flowId,
      multiStepEvaluation: true, // always persist messages in conversation mode
    };

    return this.callFlowEndpoint(
      { ...flowConfig, accessToken: resolvedToken },
      message,
      sessionId,
    );
  }

  private async callFlowEndpoint(
    config: FlowConfig,
    question: string,
    sessionId: string,
    inputVariables?: Record<string, unknown>,
  ): Promise<{ answer: string; executionId?: string }> {
    const url = `${config.basePath}/api/lflow-engine/${config.flowId}/run`;

    // Validate URL for SSRF protection (with DNS resolution check)
    await this.urlValidationService.validateUrl(url, {
      context: 'Flow endpoint URL',
      skipDnsCheck: false, // Perform DNS check at execution time
    });

    const persistAllMessages = config.multiStepEvaluation ?? false;

    const hasMessage = question.trim().length > 0;
    const messages = hasMessage
      ? [
          {
            name: 'User',
            role: 'human',
            content: [{ type: 'text', text: question }],
          },
        ]
      : [];

    const response = await this.proxyFetchService.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({
        sessionId,
        messages,
        inputVariables: inputVariables ?? {},
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

    // If responseVariableKey is set, try to read from result.variables[key]
    if (config.responseVariableKey) {
      const variableValue = data.result?.variables?.[config.responseVariableKey];
      if (variableValue !== undefined && variableValue !== null) {
        const answer = (typeof variableValue === 'string' ? variableValue : JSON.stringify(variableValue)).trim();
        if (answer.length > 0) {
          return { answer, executionId };
        }
      }
    }

    // Extract answer from result.messages[0].content[0].text
    if (data.result?.messages?.[0]?.content?.[0]?.text) {
      return { answer: data.result.messages[0].content[0].text, executionId };
    }

    return { answer: JSON.stringify(data), executionId };
  }
}
