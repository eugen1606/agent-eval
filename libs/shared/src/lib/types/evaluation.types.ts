// Evaluation Types

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

// LLM Judge Status
export interface LLMJudgeStatusResponse {
  available: boolean;
  evaluators: { id: string; name: string; model: string }[];
}

// Bulk LLM Evaluation
export interface BulkLLMEvaluationRequest {
  evaluatorId: string;
  resultIds?: string[];
  overrideExisting?: boolean;
}

// Single LLM Evaluation Result
export interface LLMEvaluationResult {
  resultId: string;
  llmJudgeScore: number;
  llmJudgeReasoning: string;
  suggestedEvaluation: HumanEvaluationStatus;
}
