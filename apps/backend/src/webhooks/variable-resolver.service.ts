import { Injectable } from '@nestjs/common';
import { WebhookEvent } from '../database/entities';
import { WebhookVariableDefinition } from '@agent-eval/shared';

export interface WebhookContext {
  event: WebhookEvent;
  timestamp: string;
  runId?: string;
  runStatus?: string;
  testId?: string;
  testName?: string;
  totalQuestions?: number;
  completedQuestions?: number;
  accuracy?: number | null;
  correctCount?: number;
  partialCount?: number;
  incorrectCount?: number;
  errorCount?: number;
  evaluatedCount?: number;
  errorMessage?: string;
}

const ALL_EVENTS: WebhookEvent[] = ['run.running', 'run.completed', 'run.failed', 'run.evaluated'];
const COMPLETION_EVENTS: WebhookEvent[] = ['run.completed', 'run.failed', 'run.evaluated'];
const EVALUATION_EVENT: WebhookEvent[] = ['run.evaluated'];

const VARIABLE_DEFINITIONS: WebhookVariableDefinition[] = [
  {
    name: 'event',
    description: 'The webhook event type',
    example: 'run.completed',
    events: ALL_EVENTS,
  },
  {
    name: 'timestamp',
    description: 'ISO 8601 timestamp when the event occurred',
    example: '2024-01-15T10:30:00.000Z',
    events: ALL_EVENTS,
  },
  {
    name: 'runId',
    description: 'The unique identifier of the run',
    example: '550e8400-e29b-41d4-a716-446655440000',
    events: ALL_EVENTS,
  },
  {
    name: 'runStatus',
    description: 'The status of the run',
    example: 'completed',
    events: ALL_EVENTS,
  },
  {
    name: 'testId',
    description: 'The unique identifier of the test',
    example: '550e8400-e29b-41d4-a716-446655440001',
    events: ALL_EVENTS,
  },
  {
    name: 'testName',
    description: 'The name of the test',
    example: 'My API Test',
    events: ALL_EVENTS,
  },
  {
    name: 'totalQuestions',
    description: 'Total number of questions in the run',
    example: '10',
    events: COMPLETION_EVENTS,
  },
  {
    name: 'completedQuestions',
    description: 'Number of completed questions',
    example: '10',
    events: COMPLETION_EVENTS,
  },
  {
    name: 'accuracy',
    description: 'Accuracy percentage (0-100)',
    example: '85.5',
    events: EVALUATION_EVENT,
  },
  {
    name: 'correctCount',
    description: 'Number of correct answers',
    example: '8',
    events: EVALUATION_EVENT,
  },
  {
    name: 'partialCount',
    description: 'Number of partially correct answers',
    example: '1',
    events: EVALUATION_EVENT,
  },
  {
    name: 'incorrectCount',
    description: 'Number of incorrect answers',
    example: '1',
    events: EVALUATION_EVENT,
  },
  {
    name: 'errorCount',
    description: 'Number of questions with errors',
    example: '0',
    events: EVALUATION_EVENT,
  },
  {
    name: 'evaluatedCount',
    description: 'Number of evaluated questions',
    example: '10',
    events: EVALUATION_EVENT,
  },
  {
    name: 'errorMessage',
    description: 'Error message when a run fails',
    example: 'Connection timeout',
    events: ['run.failed'],
  },
];

@Injectable()
export class VariableResolverService {
  getAvailableVariables(): WebhookVariableDefinition[] {
    return VARIABLE_DEFINITIONS;
  }

  getVariablesForEvents(events: WebhookEvent[]): WebhookVariableDefinition[] {
    return VARIABLE_DEFINITIONS.filter((v) =>
      v.events.some((e) => events.includes(e))
    );
  }

  resolveString(str: string, context: WebhookContext): string {
    return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      const value = context[varName as keyof WebhookContext];
      if (value === undefined || value === null) {
        return '';
      }
      return String(value);
    });
  }

  resolveObject(obj: Record<string, unknown>, context: WebhookContext): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.resolveString(value, context);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === 'string'
            ? this.resolveString(item, context)
            : typeof item === 'object' && item !== null
              ? this.resolveObject(item as Record<string, unknown>, context)
              : item
        );
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.resolveObject(value as Record<string, unknown>, context);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  resolveHeaders(
    headers: Record<string, string> | undefined,
    context: WebhookContext
  ): Record<string, string> {
    if (!headers) {
      return {};
    }

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      result[key] = this.resolveString(value, context);
    }
    return result;
  }

  resolveQueryParams(
    params: Record<string, string> | undefined,
    context: WebhookContext
  ): Record<string, string> {
    if (!params) {
      return {};
    }

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      result[key] = this.resolveString(value, context);
    }
    return result;
  }

  buildUrlWithParams(baseUrl: string, params: Record<string, string>): string {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        url.searchParams.append(key, value);
      }
    }
    return url.toString();
  }
}
