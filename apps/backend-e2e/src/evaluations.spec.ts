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

  describe('GET /api/evaluations/:id/export', () => {
    it('should export evaluation as JSON', async () => {
      const createRes = await authenticatedRequest('/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Export JSON Test',
          finalOutput: {
            results: [
              { id: '1', question: 'What is 2+2?', answer: '4', humanEvaluation: 'correct', timestamp: '2024-01-01T00:00:00Z' },
            ],
          },
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/evaluations/${created.id}/export?format=json`, {}, accessToken);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(response.headers.get('content-disposition')).toContain('attachment');

      const data = await response.json();
      expect(data.name).toBe('Export JSON Test');
      expect(data.finalOutput.results).toHaveLength(1);
    });

    it('should export evaluation as CSV', async () => {
      const createRes = await authenticatedRequest('/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Export CSV Test',
          finalOutput: {
            results: [
              { id: '1', question: 'What is 2+2?', answer: '4', humanEvaluation: 'correct', timestamp: '2024-01-01T00:00:00Z' },
              { id: '2', question: 'Capital of France?', answer: 'Paris', humanEvaluation: 'correct', timestamp: '2024-01-01T00:00:01Z' },
            ],
          },
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/evaluations/${created.id}/export?format=csv`, {}, accessToken);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/csv');
      expect(response.headers.get('content-disposition')).toContain('attachment');
      expect(response.headers.get('content-disposition')).toContain('.csv');

      const csv = await response.text();
      expect(csv).toContain('id,question,answer');
      expect(csv).toContain('What is 2+2?');
      expect(csv).toContain('Capital of France?');
      expect(csv).toContain('correct');
    });

    it('should handle CSV export with special characters', async () => {
      const createRes = await authenticatedRequest('/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Export CSV Special Chars',
          finalOutput: {
            results: [
              { id: '1', question: 'Question with, comma', answer: 'Answer with "quotes"', timestamp: '2024-01-01T00:00:00Z' },
              { id: '2', question: 'Multi\nline', answer: 'Normal answer', timestamp: '2024-01-01T00:00:01Z' },
            ],
          },
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/evaluations/${created.id}/export?format=csv`, {}, accessToken);
      expect(response.status).toBe(200);

      const csv = await response.text();
      expect(csv).toContain('"Question with, comma"');
      expect(csv).toContain('"Answer with ""quotes"""');
    });

    it('should return error for unsupported format', async () => {
      const createRes = await authenticatedRequest('/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Export Format Error Test',
          finalOutput: { results: [] },
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/evaluations/${created.id}/export?format=xml`, {}, accessToken);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.message).toContain('Unsupported export format');
    });

    it('should return error when exporting empty results as CSV', async () => {
      const createRes = await authenticatedRequest('/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Export Empty CSV Test',
          finalOutput: { config: {} },
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/evaluations/${created.id}/export?format=csv`, {}, accessToken);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.message).toContain('no results');
    });
  });
});
