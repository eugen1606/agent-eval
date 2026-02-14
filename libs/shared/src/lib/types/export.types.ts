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
  | 'runs'
  | 'personas';

export type ConflictStrategy = 'skip' | 'overwrite' | 'rename';

export interface ExportMetadata {
  version: string;
  exportedAt: string;
  exportedBy?: string;
}

export interface ExportedScenario {
  name: string;
  goal: string;
  maxTurns: number;
  orderIndex: number;
  personaExportId?: string;
}

export interface ExportedPersona {
  exportId: string;
  name: string;
  description?: string;
  systemPrompt: string;
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
  // Conversation test fields
  type?: 'qa' | 'conversation';
  executionMode?: string;
  delayBetweenTurns?: number;
  simulatedUserModel?: string;
  simulatedUserModelConfig?: { temperature?: number; maxTokens?: number };
  simulatedUserReasoningModel?: boolean;
  simulatedUserReasoningEffort?: string;
  scenarios?: ExportedScenario[];
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

export interface ExportedConversation {
  scenarioName?: string;
  status: string;
  goalAchieved?: boolean;
  totalTurns: number;
  turns: Array<{ index: number; role: 'user' | 'agent'; message: string; timestamp: string }>;
  summary?: string;
  endReason?: string;
  humanEvaluation?: string;
  humanEvaluationNotes?: string;
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
  // Conversation run fields
  totalScenarios?: number;
  completedScenarios?: number;
  conversations?: ExportedConversation[];
}

export interface ExportBundle {
  metadata: ExportMetadata;
  tests?: ExportedTest[];
  questionSets?: ExportedQuestionSet[];
  flowConfigs?: ExportedFlowConfig[];
  tags?: ExportedTag[];
  webhooks?: ExportedWebhook[];
  runs?: ExportedRun[];
  personas?: ExportedPersona[];
}

export interface ExportOptions {
  types: ExportEntityType[];
  testIds?: string[];
  questionSetIds?: string[];
  flowConfigIds?: string[];
  tagIds?: string[];
  webhookIds?: string[];
  runIds?: string[];
  personaIds?: string[];
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
    personas: number;
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
    personas: number;
  };
  skipped: {
    tests: number;
    questionSets: number;
    flowConfigs: number;
    tags: number;
    webhooks: number;
    personas: number;
  };
  overwritten: {
    tests: number;
    questionSets: number;
    flowConfigs: number;
    tags: number;
    webhooks: number;
    personas: number;
  };
  renamed: {
    tests: number;
    questionSets: number;
    flowConfigs: number;
    tags: number;
    webhooks: number;
    personas: number;
  };
  errors: string[];
}
