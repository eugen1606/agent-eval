// Run Types

import { PaginationParams, SortDirection } from './common.types';
import { StoredConversation } from './conversation.types';
import { HumanEvaluationStatus, IncorrectSeverity } from './evaluation.types';
import { StoredTest } from './test.types';

export type RunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface RunResult {
  id: string;
  question: string;
  answer: string;
  expectedAnswer?: string;
  executionId?: string;
  sessionId?: string;
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

export interface PerformanceStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface StoredRun {
  id: string;
  testId?: string;
  test?: StoredTest;
  questionSetId?: string;
  status: RunStatus;
  results: RunResult[];
  errorMessage?: string;
  totalQuestions: number;
  completedQuestions: number;
  totalScenarios?: number;
  completedScenarios?: number;
  conversations?: StoredConversation[];
  startedAt?: string;
  completedAt?: string;
  isFullyEvaluated: boolean;
  evaluatedAt?: string;
  evaluationInProgress: boolean;
  evaluationTotal?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRunRequest {
  testId: string;
  totalQuestions?: number;
}

export interface UpdateRunRequest {
  status?: RunStatus;
  errorMessage?: string;
  completedQuestions?: number;
}

export interface UpdateResultEvaluationRequest {
  resultId: string;
  humanEvaluation?: HumanEvaluationStatus;
  humanEvaluationDescription?: string;
  severity?: IncorrectSeverity;
  llmJudgeScore?: number;
  llmJudgeReasoning?: string;
}

export interface RunStats {
  total: number;
  evaluated: number;
  correct: number;
  partial: number;
  incorrect: number;
  errors: number;
  accuracy: number | null;
}

// Runs Sort and Filter
export type RunsSortField =
  | 'createdAt'
  | 'startedAt'
  | 'completedAt'
  | 'status';

export interface RunsFilterParams extends PaginationParams {
  search?: string;
  status?: RunStatus;
  testId?: string;
  runId?: string;
  questionSetId?: string;
  maxAccuracy?: number;
  sortBy?: RunsSortField;
  sortDirection?: SortDirection;
}

// Run Comparison Types
export type ChangeType = 'improved' | 'regressed' | 'unchanged' | 'new' | 'removed';

export interface ComparisonResult {
  question: string;
  leftResult?: RunResult;
  rightResult?: RunResult;
  changeType: ChangeType;
  evaluationChange?: {
    from?: HumanEvaluationStatus;
    to?: HumanEvaluationStatus;
  };
  executionTimeChange?: {
    from?: number;
    to?: number;
    delta?: number;
  };
}

export interface RunComparisonSummary {
  improved: number;
  regressed: number;
  unchanged: number;
  newQuestions: number;
  removedQuestions: number;
  accuracyDelta: number | null;
  avgLatencyDelta: number | null;
}

export interface RunComparison {
  leftRun: StoredRun;
  rightRun: StoredRun;
  summary: RunComparisonSummary;
  results: ComparisonResult[];
}
