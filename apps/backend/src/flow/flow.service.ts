import { Injectable, Logger } from '@nestjs/common';
import {
  FlowConfig,
  QuestionInput,
  EvaluationResult,
} from '@agent-eval/shared';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FlowService {
  private readonly logger = new Logger(FlowService.name);

  async executeFlow(
    config: FlowConfig,
    questions: QuestionInput[]
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (const question of questions) {
      try {
        const answer = await this.callFlowEndpoint(config, question.question);

        results.push({
          id: uuidv4(),
          question: question.question,
          answer,
          expectedAnswer: question.expectedAnswer,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.logger.error(`Failed to execute flow for question: ${question.question}`, error);
        results.push({
          id: uuidv4(),
          question: question.question,
          answer: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          expectedAnswer: question.expectedAnswer,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  private async callFlowEndpoint(
    config: FlowConfig,
    question: string
  ): Promise<string> {
    const url = `${config.basePath}/flows/${config.flowId}/execute`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      throw new Error(`Flow API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.answer || data.response || JSON.stringify(data);
  }
}
