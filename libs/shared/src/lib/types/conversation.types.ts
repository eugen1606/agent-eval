// Conversation Types

import { StoredScenario } from './scenario.types';

export type ConversationStatus =
  | 'running'
  | 'completed'
  | 'goal_achieved'
  | 'goal_not_achieved'
  | 'max_turns_reached'
  | 'error';

export interface ConversationTurn {
  index: number;
  role: 'user' | 'agent';
  message: string;
  timestamp: string;
}

export type ConversationHumanEvaluation = 'good' | 'acceptable' | 'poor';

export interface StoredConversation {
  id: string;
  runId: string;
  scenarioId: string | null;
  scenario?: StoredScenario;
  status: ConversationStatus;
  turns: ConversationTurn[];
  summary?: string;
  endReason?: string;
  goalAchieved?: boolean;
  humanEvaluation?: ConversationHumanEvaluation;
  humanEvaluationNotes?: string;
  totalTurns: number;
  startedAt?: string;
  completedAt?: string;
}

export interface EvaluateConversationRequest {
  humanEvaluation: ConversationHumanEvaluation;
  humanEvaluationNotes?: string;
  status?: ConversationStatus;
}

export interface ConversationRunStats {
  totalScenarios: number;
  completedScenarios: number;
  goalAchievedCount: number;
  goalNotAchievedCount: number;
  maxTurnsReachedCount: number;
  errorCount: number;
  averageTurns: number;
  evaluations: {
    good: number;
    acceptable: number;
    poor: number;
    unevaluated: number;
  };
}

// SSE event types for conversation runs
export interface ConversationSSEEvents {
  'scenario:start': {
    scenarioId: string;
    scenarioName: string;
    conversationId: string;
  };
  'turn:user': {
    scenarioId: string;
    conversationId: string;
    turnIndex: number;
    message: string;
  };
  'turn:agent': {
    scenarioId: string;
    conversationId: string;
    turnIndex: number;
    message: string;
  };
  'scenario:end': {
    scenarioId: string;
    conversationId: string;
    status: ConversationStatus;
    goalAchieved: boolean;
    reason: string;
    totalTurns: number;
  };
  'summary:generated': {
    scenarioId: string;
    conversationId: string;
    summary: string;
  };
  'run:complete': ConversationRunStats;
  'run:error': { errorMessage: string };
}
