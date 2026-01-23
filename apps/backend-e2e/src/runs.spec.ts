import {
  authenticatedRequest,
  createTestUser,
  deleteTestUser,
} from './support/test-setup';

describe('Runs CRUD', () => {
  let accessToken: string;
  let csrfToken: string;
  let testId: string;

  beforeAll(async () => {
    const auth = await createTestUser('-runs');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;

    // Create a FlowConfig first
    const fcRes = await authenticatedRequest(
      '/flow-configs',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Run Test Flow Config',
          flowId: 'run-test-flow',
          basePath: 'https://api.example.com',
        }),
      },
      accessToken,
    );
    const fcData = await fcRes.json();

    // Create a test to associate runs with
    const testRes = await authenticatedRequest(
      '/tests',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Run Test Parent',
          flowConfigId: fcData.id,
        }),
      },
      accessToken,
    );
    const testData = await testRes.json();
    testId = testData.id;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  describe('POST /api/runs', () => {
    it('should create a run', async () => {
      const response = await authenticatedRequest(
        '/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            testId,
            status: 'pending',
            totalQuestions: 5,
          }),
        },
        accessToken,
      );

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
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
      await authenticatedRequest(
        '/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            testId,
            status: 'pending',
          }),
        },
        accessToken,
      );

      const response = await authenticatedRequest('/runs', {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
      expect(data.pagination).toBeDefined();
    });
  });

  describe('GET /api/runs/:id', () => {
    it('should get a single run', async () => {
      const createRes = await authenticatedRequest(
        '/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            testId,
            status: 'pending',
          }),
        },
        accessToken,
      );
      const created = await createRes.json();

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
      // Use a valid UUID format that doesn't exist
      const response = await authenticatedRequest(
        '/runs/00000000-0000-0000-0000-000000000000',
        {},
        accessToken,
      );
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/runs/:id', () => {
    it('should update a run', async () => {
      const createRes = await authenticatedRequest(
        '/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            testId,
            status: 'pending',
          }),
        },
        accessToken,
      );
      const created = await createRes.json();

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
      const createRes = await authenticatedRequest(
        '/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            testId,
            status: 'pending',
          }),
        },
        accessToken,
      );
      const created = await createRes.json();

      const response = await authenticatedRequest(
        `/runs/${created.id}`,
        {
          method: 'DELETE',
        },
        accessToken,
      );

      expect(response.status).toBe(200);

      const getRes = await authenticatedRequest(
        `/runs/${created.id}`,
        {},
        accessToken,
      );
      expect(getRes.status).toBe(404);
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
      // Create a run (results are added during test execution, not via API)
      const createRes = await authenticatedRequest(
        '/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            testId,
          }),
        },
        accessToken,
      );
      const created = await createRes.json();

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
      // Create a run without any results
      const createRes = await authenticatedRequest(
        '/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            testId,
          }),
        },
        accessToken,
      );
      const created = await createRes.json();

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
        '/runs/00000000-0000-0000-0000-000000000000/performance',
        {},
        accessToken,
      );
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/runs/:id/compare/:otherId', () => {
    it('should compare two runs of the same test', async () => {
      // Create two runs for the same test
      const run1Res = await authenticatedRequest(
        '/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            testId,
          }),
        },
        accessToken,
      );
      const run1 = await run1Res.json();

      const run2Res = await authenticatedRequest(
        '/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            testId,
          }),
        },
        accessToken,
      );
      const run2 = await run2Res.json();

      // Compare the runs
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
      const run2Res = await authenticatedRequest(
        '/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            testId,
          }),
        },
        accessToken,
      );
      const run2 = await run2Res.json();

      const response = await authenticatedRequest(
        `/runs/00000000-0000-0000-0000-000000000000/compare/${run2.id}`,
        {},
        accessToken,
      );
      expect(response.status).toBe(404);
    });

    it('should return 404 when right run does not exist', async () => {
      const run1Res = await authenticatedRequest(
        '/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            testId,
          }),
        },
        accessToken,
      );
      const run1 = await run1Res.json();

      const response = await authenticatedRequest(
        `/runs/${run1.id}/compare/00000000-0000-0000-0000-000000000000`,
        {},
        accessToken,
      );
      expect(response.status).toBe(404);
    });

    it('should return 400 when comparing runs from different tests', async () => {
      // Create a second test
      const fcRes = await authenticatedRequest(
        '/flow-configs',
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'Comparison Test Flow Config 2',
            flowId: 'comparison-test-flow-2',
            basePath: 'https://api.example.com',
          }),
        },
        accessToken,
      );
      const fcData = await fcRes.json();

      const test2Res = await authenticatedRequest(
        '/tests',
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'Comparison Test 2',
            flowConfigId: fcData.id,
          }),
        },
        accessToken,
      );
      const test2 = await test2Res.json();

      // Create runs for different tests
      const run1Res = await authenticatedRequest(
        '/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            testId,
          }),
        },
        accessToken,
      );
      const run1 = await run1Res.json();

      const run2Res = await authenticatedRequest(
        '/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            testId: test2.id,
          }),
        },
        accessToken,
      );
      const run2 = await run2Res.json();

      // Comparing runs from different tests should fail
      const response = await authenticatedRequest(
        `/runs/${run1.id}/compare/${run2.id}`,
        {},
        accessToken,
      );
      expect(response.status).toBe(400);
    });

    it('should handle comparison with empty results', async () => {
      // Create two runs with no results
      const run1Res = await authenticatedRequest(
        '/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            testId,
          }),
        },
        accessToken,
      );
      const run1 = await run1Res.json();

      const run2Res = await authenticatedRequest(
        '/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            testId,
          }),
        },
        accessToken,
      );
      const run2 = await run2Res.json();

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
