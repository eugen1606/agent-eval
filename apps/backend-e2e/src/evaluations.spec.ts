import { authenticatedRequest, createTestUser } from './support/test-setup';

describe('Evaluations CRUD', () => {
  let accessToken: string;

  beforeAll(async () => {
    const auth = await createTestUser('-evaluations');
    accessToken = auth.accessToken;
  });

  describe('POST /api/evaluations', () => {
    it('should create an evaluation', async () => {
      const response = await authenticatedRequest('/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Evaluation',
          finalOutput: {
            results: [
              { id: '1', question: 'What is 2+2?', answer: '4', humanEvaluation: 'correct' },
              { id: '2', question: 'Capital of France?', answer: 'Paris', humanEvaluation: 'correct' },
            ],
          },
          flowId: 'test-flow-id',
          description: 'A test evaluation',
        }),
      }, accessToken);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Test Evaluation');
      expect(data.flowId).toBe('test-flow-id');
      expect(data.finalOutput.results).toHaveLength(2);
    });
  });

  describe('GET /api/evaluations', () => {
    it('should list evaluations', async () => {
      await authenticatedRequest('/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'List Test Evaluation',
          finalOutput: { results: [] },
        }),
      }, accessToken);

      const response = await authenticatedRequest('/evaluations', {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/evaluations/:id', () => {
    it('should get a single evaluation', async () => {
      const createRes = await authenticatedRequest('/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Get Test Evaluation',
          finalOutput: { results: [] },
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/evaluations/${created.id}`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.name).toBe('Get Test Evaluation');
    });
  });

  describe('PUT /api/evaluations/:id', () => {
    it('should update an evaluation', async () => {
      const createRes = await authenticatedRequest('/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Update Test Evaluation',
          finalOutput: { results: [{ id: '1', question: 'Test?', answer: 'Yes' }] },
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/evaluations/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Evaluation Name',
          finalOutput: {
            results: [
              { id: '1', question: 'Test?', answer: 'Yes', humanEvaluation: 'correct' },
            ],
          },
        }),
      }, accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.name).toBe('Updated Evaluation Name');
    });
  });

  describe('DELETE /api/evaluations/:id', () => {
    it('should delete an evaluation', async () => {
      const createRes = await authenticatedRequest('/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Delete Test Evaluation',
          finalOutput: { results: [] },
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/evaluations/${created.id}`, {
        method: 'DELETE',
      }, accessToken);

      expect(response.status).toBe(200);

      const getRes = await authenticatedRequest(`/evaluations/${created.id}`, {}, accessToken);
      expect(getRes.status).toBe(404);
    });
  });
});
