// Question Types

import { PaginationParams, SortDirection } from './common.types';

export interface QuestionInput {
  id: string;
  question: string;
  expectedAnswer?: string;
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

// Question Sets Sort and Filter
export type QuestionSetsSortField = 'name' | 'createdAt' | 'updatedAt';

export interface QuestionSetsFilterParams extends PaginationParams {
  search?: string;
  sortBy?: QuestionSetsSortField;
  sortDirection?: SortDirection;
}
