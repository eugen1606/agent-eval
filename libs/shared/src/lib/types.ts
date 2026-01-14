// Input Configuration Types
export interface FlowConfig {
  accessToken: string;
  accessTokenId?: string; // If set, accessToken contains a token ID to be decrypted
  basePath: string;
  flowId: string;
  multiStepEvaluation?: boolean; // If true, all questions use the same sessionId
}

export interface QuestionInput {
  id: string;
  question: string;
  expectedAnswer?: string;
}

// Human Evaluation Types
export type HumanEvaluationStatus = 'correct' | 'incorrect' | 'partial';
export type IncorrectSeverity = 'critical' | 'major' | 'minor';

// LLM Judge Types
export interface LLMJudgeRequest {
  question: string;
  answer: string;
  expectedAnswer?: string;
}

export interface LLMJudgeResponse {
  score: number;
  reasoning: string;
  isCorrect: boolean;
}

// Flow Execution Types
export interface ExecuteFlowRequest {
  config: FlowConfig;
  questions: QuestionInput[];
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Database Entity Types
export interface StoredAccessToken {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccessTokenRequest {
  name: string;
  token: string;
  description?: string;
}

export interface StoredQuestionSet {
  id: string;
  name: string;
  questions: Array<{ question: string; expectedAnswer?: string }>;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuestionSetRequest {
  name: string;
  questions: Array<{ question: string; expectedAnswer?: string }>;
  description?: string;
}

export interface StoredFlowConfig {
  id: string;
  name: string;
  flowId: string;
  basePath?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFlowConfigRequest {
  name: string;
  flowId: string;
  basePath?: string;
  description?: string;
}

// Auth Types
export interface User {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AccountStats {
  user: {
    id: string;
    email: string;
    displayName?: string;
    createdAt: string;
  };
  stats: {
    runsCount: number;
    questionSetsCount: number;
    flowConfigsCount: number;
    accessTokensCount: number;
  };
}

// Scheduled Test Types
export type ScheduledTestStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ScheduleType = 'once' | 'cron';

export interface StoredScheduledTest {
  id: string;
  name: string;
  testId: string;
  test?: StoredTest;
  scheduleType: ScheduleType;
  scheduledAt?: string;
  cronExpression?: string;
  status: ScheduledTestStatus;
  lastRunAt?: string;
  errorMessage?: string;
  resultRunId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduledTestRequest {
  name: string;
  testId: string;
  scheduleType: ScheduleType;
  scheduledAt?: string;
  cronExpression?: string;
}

// Webhook Types
export type WebhookEvent = 'evaluation.completed' | 'scheduled.completed' | 'scheduled.failed';

export interface StoredWebhook {
  id: string;
  name: string;
  url: string;
  description?: string;
  events: WebhookEvent[];
  enabled: boolean;
  secret?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookRequest {
  name: string;
  url: string;
  description?: string;
  events: WebhookEvent[];
  secret?: string;
}

// Test Types (new model)
export interface StoredTest {
  id: string;
  name: string;
  description?: string;
  flowId: string;
  basePath: string;
  accessTokenId?: string;
  questionSetId?: string;
  questionSet?: StoredQuestionSet;
  multiStepEvaluation: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTestRequest {
  name: string;
  description?: string;
  flowId: string;
  basePath: string;
  accessTokenId?: string;
  questionSetId?: string;
  multiStepEvaluation?: boolean;
}

// Run Types (new model - replaces Evaluation for new workflow)
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'canceled';

export interface RunResult {
  id: string;
  question: string;
  answer: string;
  expectedAnswer?: string;
  executionId?: string;
  isError?: boolean;
  errorMessage?: string;
  humanEvaluation?: HumanEvaluationStatus;
  humanEvaluationDescription?: string;
  severity?: IncorrectSeverity;
  llmJudgeScore?: number;
  llmJudgeReasoning?: string;
  timestamp?: string;
}

export interface StoredRun {
  id: string;
  testId?: string;
  test?: StoredTest;
  status: RunStatus;
  results: RunResult[];
  errorMessage?: string;
  totalQuestions: number;
  completedQuestions: number;
  startedAt?: string;
  completedAt?: string;
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

// Pagination Types
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Tests Filter Params
export interface TestsFilterParams extends PaginationParams {
  search?: string;
  questionSetId?: string;
  multiStep?: boolean;
  flowId?: string;
}

// Runs Filter Params
export interface RunsFilterParams extends PaginationParams {
  search?: string;
  status?: RunStatus;
  testId?: string;
}

// Scheduled Tests Filter Params
export interface ScheduledTestsFilterParams extends PaginationParams {
  search?: string;
  testId?: string;
  status?: ScheduledTestStatus;
}
