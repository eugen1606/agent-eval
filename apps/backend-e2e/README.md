# Backend E2E Tests

End-to-end tests for the BenchMark API.

## Running Tests

```bash
# Requires a running backend
yarn nx e2e backend-e2e
```

## Test Utilities

### Factories (`support/factories/`)

Each factory creates an entity via the API, asserts `201`, and returns the parsed response.

```typescript
import { createFlowConfig, createTest, createRun, createQuestionSet, createAccessToken, createTag, createWebhook } from './support/factories';

// All factories accept (accessToken, overrides?)
const flowConfig = await createFlowConfig(accessToken);
const flowConfig = await createFlowConfig(accessToken, { name: 'Custom Name', flowId: 'my-flow' });

// createTest auto-creates a FlowConfig if flowConfigId not provided
const test = await createTest(accessToken);
const test = await createTest(accessToken, { flowConfigId: fc.id, name: 'My Test' });

// createRun auto-creates a Test (and FlowConfig) if testId not provided
const run = await createRun(accessToken);
const run = await createRun(accessToken, { testId: test.id });

const questionSet = await createQuestionSet(accessToken);
const accessToken = await createAccessToken(authToken);
const tag = await createTag(authToken, { name: 'My Tag' });
const webhook = await createWebhook(authToken);
```

### Assertions (`support/assertions/`)

Helper functions that call `expect()` internally.

```typescript
import {
  NON_EXISTENT_UUID,
  expectCreated,
  expectPaginatedList,
  expectNotFound,
  expectValidationError,
  expectConflict,
  expectDeleteAndVerify,
} from './support/assertions';

// Assert 201 + id defined, returns parsed data
const data = await expectCreated(response, { name: 'Expected Name' });

// Assert 200, data array, pagination object
const result = await expectPaginatedList(response, { minLength: 1 });

// Assert 404
expectNotFound(response);

// Assert 400 with optional message matching
await expectValidationError(response, /pattern/);
await expectValidationError(response, 'substring');

// Assert 409 with optional message matching
await expectConflict(response, 'already exists');

// DELETE + verify GET returns 404
await expectDeleteAndVerify('/endpoint', id, accessToken);

// Valid UUID that doesn't exist in the database
const response = await authenticatedRequest(`/runs/${NON_EXISTENT_UUID}`, {}, accessToken);
```

## Guidelines

- Use factories for entity creation when the test expects a successful `201`
- Keep raw `authenticatedRequest` calls for validation tests (400, 409, etc.) that send intentionally bad data
- Use assertion helpers for common response patterns
