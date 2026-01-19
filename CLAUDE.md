# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**BenchMark** (Agent Eval) is an AI flow evaluation application for testing and benchmarking AI agent flows. It allows users to:
- Create reusable test configurations (flow + questions + settings)
- Execute tests to generate runs with streaming results
- Evaluate run results manually or via LLM-as-judge
- Track test performance over time with analytics
- Store and manage access tokens and question sets

## Core Concepts

- **Test** - Reusable configuration defining what to evaluate (flowId, basePath, questionSet, settings)
- **Run** - Single execution of a test, containing results and status
- **Evaluation** - Human or LLM judgment of run results (correct/partial/incorrect)

## Quick Start

```bash
# Install dependencies
yarn install

# Start database and Redis
docker-compose up -d postgres redis

# Start development servers (in separate terminals)
yarn nx serve backend     # http://localhost:3001/api
yarn nx serve frontend    # http://localhost:4201

# Default login: admin@benchmark.local / admin123
```

## Commands

```bash
# Development
yarn nx serve frontend    # React frontend (http://localhost:4201)
yarn nx serve backend     # NestJS backend (http://localhost:3001/api)

# Build
yarn nx build frontend
yarn nx build backend
yarn nx build shared
yarn nx build api-client
yarn nx run-many -t build  # Build all

# Lint & Test
yarn nx lint frontend
yarn nx lint backend
yarn nx test shared
yarn nx test api-client
yarn nx e2e backend-e2e    # E2E tests (requires running backend)

# Production
docker-compose -f docker-compose.prod.yml up --build
```

## Database Migrations

Schema changes are managed through TypeORM migrations (not `synchronize`).

### Migration Commands

```bash
# Generate migration from entity changes
yarn migration:generate apps/backend/src/database/migrations/MigrationName

# Run pending migrations (also runs automatically on app startup)
yarn migration:run

# Rollback last migration
yarn migration:revert

# Show migration status
yarn migration:show
```

### Workflow for Schema Changes

1. Modify entity file (e.g., add column to `apps/backend/src/database/entities/user.entity.ts`)
2. Generate migration: `yarn migration:generate apps/backend/src/database/migrations/AddDisplayNameToUser`
3. Review generated migration in `apps/backend/src/database/migrations/`
4. Commit both entity change and migration file together
5. On deployment, migrations run automatically on app startup

### Key Files

- `apps/backend/src/database/data-source.ts` - TypeORM CLI config (uses dotenv, not ConfigService, because CLI runs outside NestJS)
- `apps/backend/src/database/migrations/` - Migration files
- `apps/backend/src/database/database.module.ts` - Runtime config with `migrationsRun: true`

### Notes

- Never use `synchronize: true` in production
- Migrations are tracked in `typeorm_migrations` table
- Always test migrations on a copy of production data before deploying

## Architecture

Nx monorepo structure:

```
apps/
  frontend/          # React + Vite
  backend/           # NestJS API
  backend-e2e/       # E2E tests for backend
libs/
  shared/            # TypeScript types
  api-client/        # HTTP client library
```

### Backend Modules

| Module | Endpoint | Description |
|--------|----------|-------------|
| `health` | `/api/health/*` | Health checks (live, ready) |
| `auth` | `/api/auth/*` | JWT authentication (login, register, refresh, account) |
| `tests` | `/api/tests` | Test configuration CRUD + run execution (SSE) |
| `runs` | `/api/runs` | Run management, result evaluations, stats |
| `flow` | `/api/flow/*` | Execute AI flows (supports SSE streaming) |
| `evaluation` | `/api/evaluate/*` | LLM-as-judge evaluation |
| `access-tokens` | `/api/access-tokens` | Encrypted token storage |
| `questions` | `/api/questions` | Question set management |
| `flow-configs` | `/api/flow-configs` | Saved flow configurations (legacy) |
| `evaluations` | `/api/evaluations` | Stored evaluation results (legacy) |
| `webhooks` | `/api/webhooks` | Webhook management with dynamic variables |

### Database Entities

| Entity | Description |
|--------|-------------|
| `User` | Multi-user authentication |
| `Test` | Reusable test configuration (flowId, basePath, questionSetId, accessTokenId) |
| `Run` | Execution instance with results, status, timestamps |
| `AccessToken` | Encrypted tokens (AES-256-GCM) |
| `QuestionSet` | Reusable question collections |
| `FlowConfig` | Saved flow configurations (legacy) |
| `Evaluation` | Stored evaluation results (legacy) |
| `Webhook` | Webhook configurations with HTTP method, headers, query params, body template |

### Key Types (libs/shared)

```typescript
// Test configuration
StoredTest {
  id, userId, name, description?, flowId, basePath,
  accessTokenId?, questionSetId?, multiStepEvaluation, createdAt, updatedAt
}

// Run execution
StoredRun {
  id, userId?, testId?, status: 'pending' | 'running' | 'completed' | 'failed',
  results: RunResult[], errorMessage?, totalQuestions, completedQuestions,
  startedAt?, completedAt?, createdAt, updatedAt
}

// Individual result in a run
RunResult {
  id, question, answer, expectedAnswer?, executionId?,
  humanEvaluation?: 'correct' | 'partial' | 'incorrect',
  severity?: 'critical' | 'major' | 'minor',
  humanEvaluationDescription?, isError?, errorMessage?, timestamp?
}

// Webhook configuration
StoredWebhook {
  id, name, url, description?, events: WebhookEvent[],
  enabled, secret?, method: 'POST' | 'PUT' | 'PATCH',
  headers?: Record<string, string>, queryParams?: Record<string, string>,
  bodyTemplate: Record<string, unknown>, createdAt, updatedAt
}
```

### Frontend Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Homepage | Welcome + quick actions |
| `/tests` | TestsPage | Create and manage test configurations |
| `/runs` | RunsPage | View runs, execute tests with live progress |
| `/runs/:id` | RunDetailPage | Evaluate run results with bulk actions |
| `/dashboard` | Dashboard | Test Analytics + legacy Flow Analytics |
| `/settings` | SettingsPage | Manage tokens, questions, configs |
| `/account` | AccountPage | User profile, stats, password change |
| `/login` | LoginPage | Authentication |
| `/evaluate` | EvaluationPage | Legacy: Execute flows & evaluate (still accessible) |

### Key Features

1. **Test-based Workflow** - Create reusable test configs, run them, evaluate results
2. **Streaming Results** - SSE endpoint streams answers one-by-one during execution
3. **Multi-step Evaluation** - Same sessionId for conversation flows
4. **Test Analytics** - Track accuracy trends across runs with charts
5. **Bulk Evaluations** - Select all + bulk assign correct/partial/incorrect
6. **Error Handling** - Errors tracked separately, excluded from accuracy
7. **Rate Limiting** - Redis-backed rate limiting for multi-node scalability

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5433/agent_eval

# Encryption (64 hex chars - MUST be exactly 64)
ENCRYPTION_KEY=<node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

# JWT
JWT_SECRET=<128 hex chars>
JWT_REFRESH_SECRET=<128 hex chars>

# Admin user (created on first run)
ADMIN_EMAIL=admin@benchmark.local
ADMIN_PASSWORD=admin123

# Redis (for rate limiting)
REDIS_URL=redis://localhost:6380
THROTTLE_LIMIT=100        # Max requests per time window (default: 100)
THROTTLE_TTL=60000        # Time window in ms (default: 60000 = 1 minute)
THROTTLE_DISABLED=false   # Set to 'true' to disable rate limiting (auto-disabled in test env)

# Optional
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
LOG_LEVEL=info  # error, warn, info, debug, verbose
```

## Common Issues

### "Unsupported state or unable to authenticate data"
- ENCRYPTION_KEY must be exactly 64 characters
- Delete old tokens: `docker exec agent-eval-db psql -U agent_eval -d agent_eval -c "DELETE FROM access_tokens;"`

### Data not assigned to user
- Run migration on backend startup (automatic)
- Check `ADMIN_EMAIL` in .env matches expected user

## Testing Requirements

**Every new feature must include integration tests.** This is a mandatory requirement.

### E2E Test Guidelines

1. **Location**: All backend e2e tests go in `apps/backend-e2e/src/`
2. **Naming**: Use `<feature>.spec.ts` naming convention
3. **Coverage**: Test happy path, error cases, and edge cases
4. **Run tests**: `yarn nx e2e backend-e2e` (requires running backend)

### Test Structure

```typescript
// Example: apps/backend-e2e/src/feature.spec.ts
import { API_URL, createTestUser, authenticatedRequest } from './support/test-setup';

describe('Feature Name', () => {
  it('should handle success case', async () => { ... });
  it('should handle error case', async () => { ... });
  it('should validate input', async () => { ... });
});
```

### Existing Test Files

| File | Coverage |
|------|----------|
| `health.spec.ts` | Health check endpoints |
| `auth.spec.ts` | Authentication, password change, account deletion |
| `tests.spec.ts` | Tests CRUD operations |
| `runs.spec.ts` | Runs CRUD, result evaluations, bulk updates, stats |
| `questions.spec.ts` | Question sets CRUD |
| `flow-configs.spec.ts` | Flow configurations CRUD |
| `access-tokens.spec.ts` | Access tokens CRUD |
| `evaluations.spec.ts` | Evaluations CRUD |
| `data-isolation.spec.ts` | Multi-user data isolation |
| `throttling.spec.ts` | Rate limiting |
| `webhooks.spec.ts` | Webhooks CRUD, validation, variables endpoint |

## Git Conventions

- Short commit messages (one line, under 50 characters)
- No emojis in commits unless requested

## File Locations

### Backend
- Tests module: `apps/backend/src/tests/`
- Runs module: `apps/backend/src/runs/`
- Test entity: `apps/backend/src/database/entities/test.entity.ts`
- Run entity: `apps/backend/src/database/entities/run.entity.ts`
- Flow service: `apps/backend/src/flow/flow.service.ts`
- Encryption: `apps/backend/src/config/encryption.service.ts`
- Rate limiting: `apps/backend/src/throttler/`
- Webhooks module: `apps/backend/src/webhooks/`
- Webhook entity: `apps/backend/src/database/entities/webhook.entity.ts`
- Variable resolver: `apps/backend/src/webhooks/variable-resolver.service.ts`
- Migrations: `apps/backend/src/database/migrations/`
- Migration CLI config: `apps/backend/src/database/data-source.ts`

### Frontend
- Tests page: `apps/frontend/src/app/components/TestsPage.tsx`
- Runs page: `apps/frontend/src/app/components/RunsPage.tsx`
- Run detail page: `apps/frontend/src/app/components/RunDetailPage.tsx`
- Dashboard: `apps/frontend/src/app/components/Dashboard.tsx`
- Auth context: `apps/frontend/src/app/context/AuthContext.tsx`
- App context: `apps/frontend/src/app/context/AppContext.tsx`
- Webhooks manager: `apps/frontend/src/app/components/WebhooksManager.tsx`

### Shared
- API client: `libs/api-client/src/lib/api-client.ts`
- Shared types: `libs/shared/src/lib/types.ts`
- E2E tests: `apps/backend-e2e/src/`
