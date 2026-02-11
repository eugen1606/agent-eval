// Evaluator Types

import { PaginationParams, SortDirection } from './common.types';

export interface StoredEvaluator {
  id: string;
  name: string;
  description?: string;
  accessTokenId?: string;
  accessTokenName?: string;
  model: string;
  systemPrompt: string;
  reasoningModel?: boolean;
  reasoningEffort?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEvaluatorRequest {
  name: string;
  description?: string;
  accessTokenId: string;
  model: string;
  systemPrompt: string;
  reasoningModel?: boolean;
  reasoningEffort?: string;
}

export interface UpdateEvaluatorRequest {
  name?: string;
  description?: string;
  accessTokenId?: string;
  model?: string;
  systemPrompt?: string;
  reasoningModel?: boolean;
  reasoningEffort?: string;
}

export type EvaluatorsSortField = 'name' | 'createdAt' | 'updatedAt';

export interface EvaluatorsFilterParams extends PaginationParams {
  search?: string;
  sortBy?: EvaluatorsSortField;
  sortDirection?: SortDirection;
}
