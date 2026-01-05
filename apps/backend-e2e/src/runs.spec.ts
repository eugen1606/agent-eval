import { authenticatedRequest, createTestUser } from './support/test-setup';

describe('Runs CRUD', () => {
  let accessToken: string;
  let testId: string;

  beforeAll(async () => {
    const auth = await createTestUser('-runs');
    accessToken = auth.accessToken;

    // Create a test to associate runs with
    const testRes = await authenticatedRequest('/tests', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Run Test Parent',
        flowId: 'run-test-flow',
        basePath: 'https://api.example.com',
      }),
    }, accessToken);
    const testData = await testRes.json();
    testId = testData.id;
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
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
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
      const response = await authenticatedRequest('/runs/non-existent-id', {}, accessToken);
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

  describe('PUT /api/runs/:id/results/:resultId/evaluation', () => {
    it('should update a result evaluation', async () => {
      // Create a run with results
      const createRes = await authenticatedRequest('/runs', {
        method: 'POST',
        body: JSON.stringify({
          testId,
          status: 'completed',
          results: [
            { id: 'result-1', question: 'What is 2+2?', answer: '4' },
            { id: 'result-2', question: 'Capital of France?', answer: 'Paris' },
          ],
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/runs/${created.id}/results/result-1/evaluation`, {
        method: 'PUT',
        body: JSON.stringify({
          humanEvaluation: 'correct',
        }),
      }, accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      const result = data.results.find((r: { id: string }) => r.id === 'result-1');
      expect(result.humanEvaluation).toBe('correct');
    });

    it('should update with severity for incorrect evaluation', async () => {
      const createRes = await authenticatedRequest('/runs', {
        method: 'POST',
        body: JSON.stringify({
          testId,
          status: 'completed',
          results: [
            { id: 'result-sev', question: 'Wrong answer test', answer: 'wrong' },
          ],
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/runs/${created.id}/results/result-sev/evaluation`, {
        method: 'PUT',
        body: JSON.stringify({
          humanEvaluation: 'incorrect',
          severity: 'major',
          description: 'Completely wrong answer',
        }),
      }, accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      const result = data.results.find((r: { id: string }) => r.id === 'result-sev');
      expect(result.humanEvaluation).toBe('incorrect');
      expect(result.severity).toBe('major');
      expect(result.humanEvaluationDescription).toBe('Completely wrong answer');
    });
  });

  describe('PUT /api/runs/:id/results/evaluations (bulk)', () => {
    it('should bulk update result evaluations', async () => {
      const createRes = await authenticatedRequest('/runs', {
        method: 'POST',
        body: JSON.stringify({
          testId,
          status: 'completed',
          results: [
            { id: 'bulk-1', question: 'Q1', answer: 'A1' },
            { id: 'bulk-2', question: 'Q2', answer: 'A2' },
            { id: 'bulk-3', question: 'Q3', answer: 'A3' },
          ],
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/runs/${created.id}/results/evaluations`, {
        method: 'PUT',
        body: JSON.stringify({
          updates: [
            { resultId: 'bulk-1', humanEvaluation: 'correct' },
            { resultId: 'bulk-2', humanEvaluation: 'partial' },
            { resultId: 'bulk-3', humanEvaluation: 'incorrect', severity: 'minor' },
          ],
        }),
      }, accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.results.find((r: { id: string }) => r.id === 'bulk-1').humanEvaluation).toBe('correct');
      expect(data.results.find((r: { id: string }) => r.id === 'bulk-2').humanEvaluation).toBe('partial');
      expect(data.results.find((r: { id: string }) => r.id === 'bulk-3').humanEvaluation).toBe('incorrect');
    });
  });

  describe('GET /api/runs/:id/stats', () => {
    it('should return run stats', async () => {
      const createRes = await authenticatedRequest('/runs', {
        method: 'POST',
        body: JSON.stringify({
          testId,
          status: 'completed',
          results: [
            { id: 'stat-1', question: 'Q1', answer: 'A1', humanEvaluation: 'correct' },
            { id: 'stat-2', question: 'Q2', answer: 'A2', humanEvaluation: 'correct' },
            { id: 'stat-3', question: 'Q3', answer: 'A3', humanEvaluation: 'incorrect' },
            { id: 'stat-4', question: 'Q4', answer: 'A4', humanEvaluation: 'partial' },
            { id: 'stat-5', question: 'Q5', answer: 'Error', isError: true },
          ],
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/runs/${created.id}/stats`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.total).toBe(5);
      expect(data.correct).toBe(2);
      expect(data.incorrect).toBe(1);
      expect(data.partial).toBe(1);
      expect(data.errors).toBe(1);
      expect(data.unevaluated).toBe(0);
    });
  });
});
