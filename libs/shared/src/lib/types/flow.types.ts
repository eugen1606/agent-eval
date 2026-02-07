// Flow Types

import { PaginationParams, SortDirection } from './common.types';
import { QuestionInput } from './question.types';

// Input Configuration Types
export interface FlowConfig {
  accessToken: string;
  accessTokenId?: string; // If set, accessToken contains a token ID to be decrypted
  basePath: string;
  flowId: string;
  multiStepEvaluation?: boolean; // If true, all questions use the same sessionId
}

// Flow Execution Types
export interface ExecuteFlowRequest {
  config: FlowConfig;
  questions: QuestionInput[];
}

export interface StoredFlowConfig {
  id: string;
  name: string;
  flowId: string;
  basePath: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFlowConfigRequest {
  name: string;
  flowId: string;
  basePath: string;
  description?: string;
}

// Flow Configs Sort and Filter
export type FlowConfigsSortField = 'name' | 'createdAt' | 'updatedAt';

export interface FlowConfigsFilterParams extends PaginationParams {
  search?: string;
  sortBy?: FlowConfigsSortField;
  sortDirection?: SortDirection;
}
