// Export/Import Types

import { HumanEvaluationStatus, IncorrectSeverity } from './evaluation.types';
import { RunStatus } from './run.types';
import { WebhookEvent, WebhookMethod } from './webhook.types';

export type ExportEntityType =
  | 'tests'
  | 'questionSets'
  | 'flowConfigs'
  | 'tags'
  | 'webhooks'
  | 'runs';

export type ConflictStrategy = 'skip' | 'overwrite' | 'rename';

export interface ExportMetadata {
  version: string;
  exportedAt: string;
  exportedBy?: string;
}

export interface ExportedTest {
  exportId: string;
  name: string;
  description?: string;
  flowConfigExportId?: string;
  questionSetExportId?: string;
  webhookExportId?: string;
  tagExportIds?: string[];
  multiStepEvaluation: boolean;
}

export interface ExportedQuestionSet {
  exportId: string;
  name: string;
  description?: string;
  questions: Array<{ question: string; expectedAnswer?: string }>;
}

export interface ExportedFlowConfig {
  exportId: string;
  name: string;
  description?: string;
  flowId: string;
  basePath: string;
}

export interface ExportedTag {
  exportId: string;
  name: string;
  color?: string;
}

export interface ExportedWebhook {
  exportId: string;
  name: string;
  url: string;
  description?: string;
  events: WebhookEvent[];
  enabled: boolean;
  method: WebhookMethod;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  bodyTemplate?: Record<string, unknown>;
}

export interface ExportedRunResult {
  question: string;
  answer: string;
  expectedAnswer?: string;
  executionTimeMs?: number;
  isError?: boolean;
  errorMessage?: string;
  humanEvaluation?: HumanEvaluationStatus;
  humanEvaluationDescription?: string;
  severity?: IncorrectSeverity;
  llmJudgeScore?: number;
  llmJudgeReasoning?: string;
  timestamp?: string;
}

export interface ExportedRun {
  exportId: string;
  testName?: string;
  testExportId?: string;
  status: RunStatus;
  results: ExportedRunResult[];
  errorMessage?: string;
  totalQuestions: number;
  completedQuestions: number;
  isFullyEvaluated: boolean;
  startedAt?: string;
  completedAt?: string;
  evaluatedAt?: string;
  createdAt: string;
}

export interface ExportBundle {
  metadata: ExportMetadata;
  tests?: ExportedTest[];
  questionSets?: ExportedQuestionSet[];
  flowConfigs?: ExportedFlowConfig[];
  tags?: ExportedTag[];
  webhooks?: ExportedWebhook[];
  runs?: ExportedRun[];
}

export interface ExportOptions {
  types: ExportEntityType[];
  testIds?: string[];
  questionSetIds?: string[];
  flowConfigIds?: string[];
  tagIds?: string[];
  webhookIds?: string[];
  runIds?: string[];
}

export interface ImportOptions {
  conflictStrategy: ConflictStrategy;
}

export interface ImportConflict {
  type: ExportEntityType;
  exportId: string;
  name: string;
  existingId: string;
}

export interface ImportPreviewResult {
  toCreate: {
    tests: number;
    questionSets: number;
    flowConfigs: number;
    tags: number;
    webhooks: number;
  };
  conflicts: ImportConflict[];
  errors: string[];
}

export interface ImportResult {
  created: {
    tests: number;
    questionSets: number;
    flowConfigs: number;
    tags: number;
    webhooks: number;
  };
  skipped: {
    tests: number;
    questionSets: number;
    flowConfigs: number;
    tags: number;
    webhooks: number;
  };
  overwritten: {
    tests: number;
    questionSets: number;
    flowConfigs: number;
    tags: number;
    webhooks: number;
  };
  renamed: {
    tests: number;
    questionSets: number;
    flowConfigs: number;
    tags: number;
    webhooks: number;
  };
  errors: string[];
}
