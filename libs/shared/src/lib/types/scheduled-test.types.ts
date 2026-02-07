// Scheduled Test Types

import { PaginationParams, SortDirection } from './common.types';
import { StoredTest } from './test.types';

export type ScheduledTestStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';
export type ScheduleType = 'once' | 'cron';

export interface StoredScheduledTest {
  id: string;
  name: string;
  testId: string;
  test?: StoredTest;
  scheduleType: ScheduleType;
  scheduledAt?: string;
  cronExpression?: string;
  status: ScheduledTestStatus;
  lastRunAt?: string;
  errorMessage?: string;
  resultRunId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduledTestRequest {
  name: string;
  testId: string;
  scheduleType: ScheduleType;
  scheduledAt?: string;
  cronExpression?: string;
}

// Scheduled Tests Sort and Filter
export type ScheduledTestsSortField =
  | 'name'
  | 'scheduledAt'
  | 'lastRunAt'
  | 'status'
  | 'createdAt';

export interface ScheduledTestsFilterParams extends PaginationParams {
  search?: string;
  testId?: string;
  status?: ScheduledTestStatus;
  sortBy?: ScheduledTestsSortField;
  sortDirection?: SortDirection;
}
