import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';

describe('Runs CRUD', () => {
  let accessToken: string;
  let csrfToken: string;
  let testId: string;

  beforeAll(async () => {
    const auth = await createTestUser('-runs');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;

    // Create a FlowConfig first
    const fcRes = await authenticatedRequest('/flow-configs', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Run Test Flow Config',
        flowId: 'run-test-flow',
        basePath: 'https://api.example.com',
      }),
    }, accessToken);
    const fcData = await fcRes.json();

    // Create a test to associate runs with
    const testRes = await authenticatedRequest('/tests', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Run Test Parent',
        flowConfigId: fcData.id,
      }),
    }, accessToken);
    const testData = await testRes.json();
    testId = testData.id;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  describe('POST /api/runs', () => {
    it('should create a run', async () => {
      const response = await authenticatedRequest('/runs', {
        method: 'POST',
        body: JSON.stringify({
          testId,
          status: 'pending',
          totalQuestions: 5,
        }),
      }, accessToken);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.testId).toBe(testId);
      expect(data.status).toBe('pending');
      expect(data.totalQuestions).toBe(5);
    });

    it('should create a run without testId', async () => {
      const response = await authenticatedRequest('/runs', {
        method: 'POST',
        body: JSON.stringify({
          status: 'pending',
        }),
      }, accessToken);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.testId).toBeNull();
    });
  });

  describe('GET /api/runs', () => {
    it('should list runs', async () => {
      await authenticatedRequest('/runs', {
        method: 'POST',
        body: JSON.stringify({
          testId,
          status: 'pending',
        }),
      }, accessToken);

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
      const createRes = await authenticatedRequest('/runs', {
        method: 'POST',
        body: JSON.stringify({
          testId,
          status: 'pending',
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/runs/${created.id}`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.testId).toBe(testId);
    });

    it('should return 404 for non-existent run', async () => {
      // Use a valid UUID format that doesn't exist
      const response = await authenticatedRequest('/runs/00000000-0000-0000-0000-000000000000', {}, accessToken);
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/runs/:id', () => {
    it('should update a run', async () => {
      const createRes = await authenticatedRequest('/runs', {
        method: 'POST',
        body: JSON.stringify({
          testId,
          status: 'pending',
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/runs/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'running',
          completedQuestions: 2,
        }),
      }, accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('running');
      expect(data.completedQuestions).toBe(2);
    });
  });

  describe('DELETE /api/runs/:id', () => {
    it('should delete a run', async () => {
      const createRes = await authenticatedRequest('/runs', {
        method: 'POST',
        body: JSON.stringify({
          testId,
          status: 'pending',
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/runs/${created.id}`, {
        method: 'DELETE',
      }, accessToken);

      expect(response.status).toBe(200);

      const getRes = await authenticatedRequest(`/runs/${created.id}`, {}, accessToken);
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
      const createRes = await authenticatedRequest('/runs', {
        method: 'POST',
        body: JSON.stringify({
          testId,
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/runs/${created.id}/stats`, {}, accessToken);
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
});
