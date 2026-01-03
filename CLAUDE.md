# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**BenchMark** (Agent Eval) is an AI flow evaluation application for testing and benchmarking AI agent flows. It allows users to:
- Execute AI flows against question sets
- Evaluate responses manually or via LLM-as-judge
- Track flow performance over time with analytics
- Store and manage reusable configurations

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
| `flow` | `/api/flow/*` | Execute AI flows (supports SSE streaming) |
| `evaluation` | `/api/evaluate/*` | LLM-as-judge evaluation |
| `access-tokens` | `/api/access-tokens` | Encrypted token storage |
| `questions` | `/api/questions` | Question set management |
| `flow-configs` | `/api/flow-configs` | Saved flow configurations |
| `evaluations` | `/api/evaluations` | Stored evaluation results |

### Database Entities

- `User` - Multi-user authentication
- `AccessToken` - Encrypted tokens (AES-256-GCM)
- `Evaluation` - Results with flow exports
- `QuestionSet` - Reusable question collections
- `FlowConfig` - Saved flow configurations

### Key Types (libs/shared)

```typescript
FlowConfig {
  accessToken, accessTokenId?, basePath, flowId, multiStepEvaluation?
}

EvaluationResult {
  id, question, answer, expectedAnswer?, executionId?,
  humanEvaluation?, severity?, isError?, errorMessage?
}
```

### Frontend Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Homepage | Welcome + quick actions |
| `/evaluate` | EvaluationPage | Execute flows & evaluate results |
| `/dashboard` | Dashboard | View evaluations + Flow Analytics |
| `/settings` | SettingsPage | Manage tokens, questions, configs |
| `/account` | AccountPage | User profile, stats, password change |
| `/login` | LoginPage | Authentication |

### Key Features

1. **Streaming Results** - SSE endpoint streams answers one-by-one
2. **Multi-step Evaluation** - Same sessionId for conversation flows
3. **Flow Analytics** - Track accuracy trends across evaluations
4. **Error Handling** - Errors excluded from human evaluation
5. **Bulk Actions** - Select all + bulk assign evaluations
6. **Rate Limiting** - Redis-backed rate limiting for multi-node scalability

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
| `questions.spec.ts` | Question sets CRUD |
| `flow-configs.spec.ts` | Flow configurations CRUD |
| `access-tokens.spec.ts` | Access tokens CRUD |
| `evaluations.spec.ts` | Evaluations CRUD |
| `data-isolation.spec.ts` | Multi-user data isolation |
| `throttling.spec.ts` | Rate limiting |

## Git Conventions

- Short commit messages (one line, under 50 characters)
- No emojis in commits unless requested

## File Locations

- API client: `libs/api-client/src/lib/api-client.ts`
- Shared types: `libs/shared/src/lib/types.ts`
- Auth context: `apps/frontend/src/app/context/AuthContext.tsx`
- App context: `apps/frontend/src/app/context/AppContext.tsx`
- Flow service: `apps/backend/src/flow/flow.service.ts`
- Encryption: `apps/backend/src/config/encryption.service.ts`
- Rate limiting: `apps/backend/src/throttler/`
- E2E tests: `apps/backend-e2e/src/`
