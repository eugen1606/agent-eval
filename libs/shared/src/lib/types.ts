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

// Evaluation Types
export type HumanEvaluationStatus = 'correct' | 'incorrect' | 'partial';
export type IncorrectSeverity = 'critical' | 'major' | 'minor';

export interface EvaluationResult {
  id: string;
  question: string;
  answer: string;
  expectedAnswer?: string;
  executionId?: string;
  isCorrect?: boolean;
  llmJudgeScore?: number;
  llmJudgeReasoning?: string;
  humanEvaluation?: HumanEvaluationStatus;
  humanEvaluationDescription?: string;
  severity?: IncorrectSeverity;
  isError?: boolean;
  errorMessage?: string;
  timestamp: string;
}

export interface EvaluationSession {
  id: string;
  flowName: string;
  flowConfig: FlowConfig;
  results: EvaluationResult[];
  createdAt: string;
  updatedAt: string;
}

// API Request/Response Types
export interface ExecuteFlowRequest {
  config: FlowConfig;
  questions: QuestionInput[];
}

export interface ExecuteFlowResponse {
  sessionId: string;
  results: EvaluationResult[];
}

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

// Database/Storage Types
export interface SaveSessionRequest {
  flowName: string;
  session: EvaluationSession;
}

export interface ExportFormat {
  type: 'json' | 'csv';
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

export interface StoredEvaluation {
  id: string;
  name: string;
  finalOutput: Record<string, unknown>;
  flowExport?: Record<string, unknown>;
  flowId?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEvaluationRequest {
  name: string;
  finalOutput: Record<string, unknown>;
  flowExport?: Record<string, unknown>;
  flowId?: string;
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

// Scheduled Evaluation Types
export type ScheduledEvaluationStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ScheduleType = 'once' | 'cron';

export interface StoredScheduledEvaluation {
  id: string;
  name: string;
  description?: string;
  accessTokenId: string;
  flowConfigId: string;
  questionSetId: string;
  scheduleType: ScheduleType;
  scheduledAt?: string;
  cronExpression?: string;
  multiStepEvaluation: boolean;
  status: ScheduledEvaluationStatus;
  lastRunAt?: string;
  errorMessage?: string;
  resultEvaluationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduledEvaluationRequest {
  name: string;
  description?: string;
  accessTokenId: string;
  flowConfigId: string;
  questionSetId: string;
  scheduleType?: ScheduleType;
  scheduledAt?: string;
  cronExpression?: string;
  multiStepEvaluation?: boolean;
}
