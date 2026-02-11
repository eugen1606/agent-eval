import { Injectable, Logger } from '@nestjs/common';
import { LLMJudgeResponse, HumanEvaluationStatus } from '@agent-eval/shared';

export interface EvaluationConfig {
  apiKey: string;
  provider: 'openai' | 'anthropic';
  model: string;
  systemPrompt: string;
  reasoningModel?: boolean;
  reasoningEffort?: string;
}

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  async evaluateWithLLM(
    question: string,
    answer: string,
    expectedAnswer: string | undefined,
    config: EvaluationConfig
  ): Promise<LLMJudgeResponse> {
    const userMessage = this.buildUserMessage(question, answer, expectedAnswer);

    try {
      let llmResponse: string;
      if (config.provider === 'openai') {
        llmResponse = await this.callOpenAI(
          config.systemPrompt,
          userMessage,
          config.apiKey,
          config.model,
          config.reasoningModel,
          config.reasoningEffort
        );
      } else {
        llmResponse = await this.callAnthropic(
          config.systemPrompt,
          userMessage,
          config.apiKey,
          config.model
        );
      }
      return this.parseEvaluationResponse(llmResponse);
    } catch (error) {
      this.logger.error('LLM evaluation failed', error);
      return {
        score: 0,
        reasoning: `Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isCorrect: false,
      };
    }
  }

  static scoreToEvaluation(score: number): HumanEvaluationStatus {
    if (score >= 80) return 'correct';
    if (score >= 40) return 'partial';
    return 'incorrect';
  }

  private buildUserMessage(question: string, answer: string, expectedAnswer?: string): string {
    let message = `Question: ${question}\n\nProvided Answer: ${answer}`;
    if (expectedAnswer) {
      message += `\n\nExpected Answer: ${expectedAnswer}`;
    }
    return message;
  }

  private async callOpenAI(
    systemPrompt: string,
    userMessage: string,
    apiKey: string,
    model: string,
    reasoningModel?: boolean,
    reasoningEffort?: string
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const requestBody: Record<string, unknown> = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      };

      if (reasoningModel) {
        requestBody['temperature'] = 1;
        if (reasoningEffort && reasoningEffort !== 'none') {
          requestBody['reasoning_effort'] = reasoningEffort;
        }
      } else {
        requestBody['temperature'] = 0;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`OpenAI API error: ${response.status} ${errorBody}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callAnthropic(
    systemPrompt: string,
    userMessage: string,
    apiKey: string,
    model: string
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Anthropic API error: ${response.status} ${errorBody}`);
      }

      const data = await response.json();
      return data.content[0].text;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseEvaluationResponse(response: string): LLMJudgeResponse {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: parsed.score ?? 0,
          isCorrect: parsed.isCorrect ?? false,
          reasoning: parsed.reasoning ?? 'No reasoning provided',
        };
      }
    } catch {
      this.logger.warn('Failed to parse LLM response as JSON');
    }

    return {
      score: 50,
      isCorrect: false,
      reasoning: response,
    };
  }
}
