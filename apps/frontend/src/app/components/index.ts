// UI Components (re-exported from @agent-eval/ui library)
export {
  Modal,
  ConfirmDialog,
  AlertDialog,
  Pagination,
  usePagination,
  SearchableSelect,
  FilterBar,
} from '@agent-eval/ui';
export type {
  FilterDefinition,
  SortOption,
  ActiveFilter,
} from '@agent-eval/ui';

// Re-export from features for backward compatibility
export { LoginPage } from '../features/auth/LoginPage';
export { RegisterPage } from '../features/auth/RegisterPage';
export { AccountPage } from '../features/auth/AccountPage';

export { TestsPage } from '../features/tests/TestsPage';

export { RunsPage } from '../features/runs/RunsPage';
export { RunDetailPage } from '../features/runs/RunDetailPage';
export { RunComparisonPage } from '../features/runs/RunComparisonPage';
export { ConversationRunDetailPage } from '../features/runs/ConversationRunDetailPage';

export { Dashboard } from '../features/dashboard/Dashboard';
export { Homepage } from '../features/dashboard/Homepage';

export { AccessTokensManager } from '../features/settings/AccessTokensManager';
export { QuestionSetsManager } from '../features/settings/QuestionSetsManager';
export { FlowConfigsManager } from '../features/settings/FlowConfigsManager';
export { WebhooksManager } from '../features/settings/WebhooksManager';
export { TagManager } from '../features/settings/TagManager';
export { EvaluatorsManager } from '../features/settings/EvaluatorsManager';
export { PersonasManager } from '../features/settings/PersonasManager';

export { ScheduledTestsPage } from '../features/scheduled-tests/ScheduledTestsPage';

export { ProtectedRoute } from '../shared/ProtectedRoute';
