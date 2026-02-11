// Access Token Types

import { PaginationParams, SortDirection } from './common.types';

export type AccessTokenType = 'ai_studio' | 'openai' | 'anthropic';

export interface StoredAccessToken {
  id: string;
  name: string;
  description?: string;
  type: AccessTokenType;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccessTokenRequest {
  name: string;
  token: string;
  description?: string;
  type?: AccessTokenType;
}

// Access Tokens Sort and Filter
export type AccessTokensSortField = 'name' | 'createdAt' | 'updatedAt';

export interface AccessTokensFilterParams extends PaginationParams {
  search?: string;
  type?: AccessTokenType;
  sortBy?: AccessTokensSortField;
  sortDirection?: SortDirection;
}
