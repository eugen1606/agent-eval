// Persona Types

import { PaginationParams, SortDirection } from './common.types';

export interface StoredPersona {
  id: string;
  userId: string | null;
  name: string;
  description?: string;
  systemPrompt: string;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonaRequest {
  name: string;
  description?: string;
  systemPrompt: string;
}

export interface UpdatePersonaRequest {
  name?: string;
  description?: string | null;
  systemPrompt?: string;
}

// Personas Sort and Filter
export type PersonasSortField = 'name' | 'createdAt' | 'updatedAt';

export interface PersonasFilterParams extends PaginationParams {
  search?: string;
  sortBy?: PersonasSortField;
  sortDirection?: SortDirection;
}
