// Webhook Types

import { PaginationParams, SortDirection } from './common.types';

export type WebhookEvent =
  | 'run.running'
  | 'run.completed'
  | 'run.failed'
  | 'run.evaluated';
export type WebhookMethod = 'POST' | 'PUT' | 'PATCH';

export interface WebhookVariableDefinition {
  name: string;
  description: string;
  example: string;
  events: WebhookEvent[];
}

export interface StoredWebhook {
  id: string;
  name: string;
  url: string;
  description?: string;
  events: WebhookEvent[];
  enabled: boolean;
  secret?: string;
  method: WebhookMethod;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  bodyTemplate?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookRequest {
  name: string;
  url: string;
  description?: string;
  events: WebhookEvent[];
  secret?: string;
  method: WebhookMethod;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  bodyTemplate: Record<string, unknown>;
}

// Webhooks Sort and Filter
export type WebhooksSortField = 'name' | 'createdAt' | 'updatedAt';

export interface WebhooksFilterParams extends PaginationParams {
  search?: string;
  enabled?: boolean;
  event?: WebhookEvent;
  sortBy?: WebhooksSortField;
  sortDirection?: SortDirection;
}
