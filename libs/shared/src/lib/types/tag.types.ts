// Tag Types

import { PaginationParams, SortDirection } from './common.types';

export interface StoredTag {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTagRequest {
  name: string;
  color?: string;
}

// Tags Sort and Filter
export type TagsSortField = 'name' | 'createdAt' | 'updatedAt';

export interface TagsFilterParams extends PaginationParams {
  search?: string;
  sortBy?: TagsSortField;
  sortDirection?: SortDirection;
}
