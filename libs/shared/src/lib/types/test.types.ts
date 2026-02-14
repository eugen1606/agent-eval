// Test Types

import { PaginationParams, SortDirection } from './common.types';
import { StoredFlowConfig } from './flow.types';
import { StoredQuestionSet } from './question.types';
import { CreateScenarioRequest, StoredScenario } from './scenario.types';
import { StoredTag } from './tag.types';
import { StoredWebhook } from './webhook.types';

export type TestType = 'qa' | 'conversation';
export type ConversationExecutionMode = 'sequential' | 'parallel';

export interface SimulatedUserModelConfig {
  temperature?: number;
  maxTokens?: number;
}

export interface StoredTest {
  id: string;
  name: string;
  description?: string;
  type: TestType;
  flowConfigId?: string;
  flowConfig?: StoredFlowConfig;
  accessTokenId?: string;
  questionSetId?: string;
  questionSet?: StoredQuestionSet;
  multiStepEvaluation: boolean;
  webhookId?: string;
  webhook?: StoredWebhook;
  evaluatorId?: string;
  tags?: StoredTag[];
  executionMode?: ConversationExecutionMode;
  delayBetweenTurns?: number;
  simulatedUserModel?: string;
  simulatedUserModelConfig?: SimulatedUserModelConfig;
  simulatedUserAccessTokenId?: string;
  simulatedUserReasoningModel?: boolean;
  simulatedUserReasoningEffort?: string;
  scenarios?: StoredScenario[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTestRequest {
  name: string;
  description?: string;
  type?: TestType;
  flowConfigId: string;
  accessTokenId?: string | null;
  questionSetId?: string | null;
  multiStepEvaluation?: boolean;
  webhookId?: string | null;
  evaluatorId?: string | null;
  tagIds?: string[];
  executionMode?: ConversationExecutionMode;
  delayBetweenTurns?: number;
  simulatedUserModel?: string;
  simulatedUserModelConfig?: SimulatedUserModelConfig;
  simulatedUserAccessTokenId?: string | null;
  simulatedUserReasoningModel?: boolean;
  simulatedUserReasoningEffort?: string;
  scenarios?: CreateScenarioRequest[];
}

// Tests Sort and Filter
export type TestsSortField = 'name' | 'createdAt' | 'updatedAt';

export interface TestsFilterParams extends PaginationParams {
  search?: string;
  type?: TestType;
  questionSetId?: string;
  accessTokenId?: string;
  webhookId?: string;
  multiStep?: boolean;
  flowConfigId?: string;
  tagIds?: string[];
  sortBy?: TestsSortField;
  sortDirection?: SortDirection;
}
