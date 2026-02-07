import {
  authenticatedRequest,
  createTestUser,
  deleteTestUser,
} from './support/test-setup';
import { createTest, createRun } from './support/factories';
import {
  NON_EXISTENT_UUID,
  expectNotFound,
  expectPaginatedList,
  expectDeleteAndVerify,
} from './support/assertions';

describe('Runs CRUD', () => {
  let accessToken: string;
  let csrfToken: string;
  let testId: string;

  beforeAll(async () => {
    const auth = await createTestUser('-runs');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;

    const test = await createTest(accessToken, { name: 'Run Test Parent' });
    testId = test.id as string;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  describe('POST /api/runs', () => {
    it('should create a run', async () => {
      const data = await createRun(accessToken, { testId, totalQuestions: 5 });

      expect(data.testId).toBe(testId);
      expect(data.status).toBe('pending');
      expect(data.totalQuestions).toBe(5);
    });

    it('should create a run without testId', async () => {
      const response = await authenticatedRequest(
        '/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            status: 'pending',
          }),
        },
        accessToken,
      );

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.testId).toBeNull();
    });
  });

  describe('GET /api/runs', () => {
    it('should list runs', async () => {
      await createRun(accessToken, { testId });

      const response = await authenticatedRequest('/runs', {}, accessToken);
      await expectPaginatedList(response, { minLength: 1 });
    });
  });

  describe('GET /api/runs/:id', () => {
    it('should get a single run', async () => {
      const created = await createRun(accessToken, { testId });

      const response = await authenticatedRequest(
        `/runs/${created.id}`,
        {},
        accessToken,
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.testId).toBe(testId);
    });

    it('should return 404 for non-existent run', async () => {
      const response = await authenticatedRequest(
        `/runs/${NON_EXISTENT_UUID}`,
        {},
        accessToken,
      );
      expectNotFound(response);
    });
  });

  describe('PUT /api/runs/:id', () => {
    it('should update a run', async () => {
      const created = await createRun(accessToken, { testId });

      const response = await authenticatedRequest(
        `/runs/${created.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            status: 'running',
            completedQuestions: 2,
          }),
        },
        accessToken,
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('running');
      expect(data.completedQuestions).toBe(2);
    });
  });

  describe('DELETE /api/runs/:id', () => {
    it('should delete a run', async () => {
      const created = await createRun(accessToken, { testId });
      await expectDeleteAndVerify('/runs', created.id as string, accessToken);
    });
  });

  // These tests require runs with pre-populated results, which is done through
  // SSE streaming during test execution, not via the API directly.
  // TODO: Rewrite these tests to use proper test execution flow
  describe.skip('PUT /api/runs/:id/results/:resultId/evaluation', () => {
    it('should update a result evaluation', async () => {
      // Test skipped - requires results to be added through test execution
    });

    it('should update with severity for incorrect evaluation', async () => {
      // Test skipped - requires results to be added through test execution
    });
  });

  // TODO: Rewrite to use proper test execution flow
  describe.skip('PUT /api/runs/:id/results/evaluations (bulk)', () => {
    it('should bulk update result evaluations', async () => {
      // Test skipped - requires results to be added through test execution
    });
  });

  describe('GET /api/runs/:id/stats', () => {
    it('should return run stats', async () => {
      const created = await createRun(accessToken, { testId });

      const response = await authenticatedRequest(
        `/runs/${created.id}/stats`,
        {},
        accessToken,
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      // New run has no results
      expect(data.total).toBe(0);
      expect(data.correct).toBe(0);
      expect(data.incorrect).toBe(0);
      expect(data.partial).toBe(0);
      expect(data.errors).toBe(0);
      expect(data.accuracy).toBeNull();
    });
  });

  describe('GET /api/runs/:id/performance', () => {
    it('should return null performance stats for run without results', async () => {
      const created = await createRun(accessToken, { testId });

      const response = await authenticatedRequest(
        `/runs/${created.id}/performance`,
        {},
        accessToken,
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      // No results means null stats
      expect(data.count).toBe(0);
      expect(data.min).toBeNull();
      expect(data.max).toBeNull();
      expect(data.avg).toBeNull();
      expect(data.p50).toBeNull();
      expect(data.p95).toBeNull();
      expect(data.p99).toBeNull();
    });

    it('should return 404 for non-existent run', async () => {
      const response = await authenticatedRequest(
        `/runs/${NON_EXISTENT_UUID}/performance`,
        {},
        accessToken,
      );
      expectNotFound(response);
    });
  });

  describe('GET /api/runs/:id/compare/:otherId', () => {
    it('should compare two runs of the same test', async () => {
      const run1 = await createRun(accessToken, { testId });
      const run2 = await createRun(accessToken, { testId });

      const response = await authenticatedRequest(
        `/runs/${run1.id}/compare/${run2.id}`,
        {},
        accessToken,
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.leftRun).toBeDefined();
      expect(data.rightRun).toBeDefined();
      expect(data.summary).toBeDefined();
      expect(data.results).toBeDefined();

      expect(data.leftRun.id).toBe(run1.id);
      expect(data.rightRun.id).toBe(run2.id);

      // Summary should have all expected fields
      expect(data.summary.improved).toBeDefined();
      expect(data.summary.regressed).toBeDefined();
      expect(data.summary.unchanged).toBeDefined();
      expect(data.summary.newQuestions).toBeDefined();
      expect(data.summary.removedQuestions).toBeDefined();
      expect(data.summary).toHaveProperty('accuracyDelta');
      expect(data.summary).toHaveProperty('avgLatencyDelta');
    });

    it('should return 404 when left run does not exist', async () => {
      const run2 = await createRun(accessToken, { testId });

      const response = await authenticatedRequest(
        `/runs/${NON_EXISTENT_UUID}/compare/${run2.id}`,
        {},
        accessToken,
      );
      expectNotFound(response);
    });

    it('should return 404 when right run does not exist', async () => {
      const run1 = await createRun(accessToken, { testId });

      const response = await authenticatedRequest(
        `/runs/${run1.id}/compare/${NON_EXISTENT_UUID}`,
        {},
        accessToken,
      );
      expectNotFound(response);
    });

    it('should return 400 when comparing runs from different tests', async () => {
      const test2 = await createTest(accessToken, { name: 'Comparison Test 2' });

      const run1 = await createRun(accessToken, { testId });
      const run2 = await createRun(accessToken, { testId: test2.id });

      // Comparing runs from different tests should fail
      const response = await authenticatedRequest(
        `/runs/${run1.id}/compare/${run2.id}`,
        {},
        accessToken,
      );
      expect(response.status).toBe(400);
    });

    it('should handle comparison with empty results', async () => {
      const run1 = await createRun(accessToken, { testId });
      const run2 = await createRun(accessToken, { testId });

      const response = await authenticatedRequest(
        `/runs/${run1.id}/compare/${run2.id}`,
        {},
        accessToken,
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.results).toEqual([]);
      expect(data.summary.improved).toBe(0);
      expect(data.summary.regressed).toBe(0);
      expect(data.summary.unchanged).toBe(0);
      expect(data.summary.newQuestions).toBe(0);
      expect(data.summary.removedQuestions).toBe(0);
    });
  });
});
