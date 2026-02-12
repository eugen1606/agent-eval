// Test Types

import { PaginationParams, SortDirection } from './common.types';
import { StoredFlowConfig } from './flow.types';
import { StoredQuestionSet } from './question.types';
import { StoredTag } from './tag.types';
import { StoredWebhook } from './webhook.types';

export interface StoredTest {
  id: string;
  name: string;
  description?: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateTestRequest {
  name: string;
  description?: string;
  flowConfigId: string;
  accessTokenId?: string | null;
  questionSetId?: string | null;
  multiStepEvaluation?: boolean;
  webhookId?: string | null;
  evaluatorId?: string | null;
  tagIds?: string[];
}

// Tests Sort and Filter
export type TestsSortField = 'name' | 'createdAt' | 'updatedAt';

export interface TestsFilterParams extends PaginationParams {
  search?: string;
  questionSetId?: string;
  accessTokenId?: string;
  webhookId?: string;
  multiStep?: boolean;
  flowConfigId?: string;
  tagIds?: string[];
  sortBy?: TestsSortField;
  sortDirection?: SortDirection;
}
