// Access Token Types

import { PaginationParams, SortDirection } from './common.types';

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

// Access Tokens Sort and Filter
export type AccessTokensSortField = 'name' | 'createdAt' | 'updatedAt';

export interface AccessTokensFilterParams extends PaginationParams {
  search?: string;
  sortBy?: AccessTokensSortField;
  sortDirection?: SortDirection;
}
