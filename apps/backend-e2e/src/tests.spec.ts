import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';

describe('Tests CRUD', () => {
  let accessToken: string;

  beforeAll(async () => {
    const auth = await createTestUser('-tests');
    accessToken = auth.accessToken;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken);
  });

  describe('POST /api/tests', () => {
    it('should create a test', async () => {
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Flow Evaluation',
          description: 'A test for evaluating flow responses',
          flowId: 'test-flow-123',
          basePath: 'https://api.example.com',
          multiStepEvaluation: false,
        }),
      }, accessToken);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Test Flow Evaluation');
      expect(data.flowId).toBe('test-flow-123');
      expect(data.basePath).toBe('https://api.example.com');
      expect(data.multiStepEvaluation).toBe(false);
    });

    it('should require name and flowId', async () => {
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          basePath: 'https://api.example.com',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/tests', () => {
    it('should list tests', async () => {
      await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'List Test',
          flowId: 'list-flow',
          basePath: 'https://api.example.com',
        }),
      }, accessToken);

      const response = await authenticatedRequest('/tests', {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/tests/:id', () => {
    it('should get a single test', async () => {
      const createRes = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Get Test',
          flowId: 'get-flow',
          basePath: 'https://api.example.com',
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/tests/${created.id}`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.name).toBe('Get Test');
    });

    it('should return 404 for non-existent test', async () => {
      const response = await authenticatedRequest('/tests/non-existent-id', {}, accessToken);
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/tests/:id', () => {
    it('should update a test', async () => {
      const createRes = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Update Test',
          flowId: 'update-flow',
          basePath: 'https://api.example.com',
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/tests/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Test Name',
          description: 'Updated description',
          multiStepEvaluation: true,
        }),
      }, accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.name).toBe('Updated Test Name');
      expect(data.description).toBe('Updated description');
      expect(data.multiStepEvaluation).toBe(true);
    });
  });

  describe('DELETE /api/tests/:id', () => {
    it('should delete a test', async () => {
      const createRes = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Delete Test',
          flowId: 'delete-flow',
          basePath: 'https://api.example.com',
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/tests/${created.id}`, {
        method: 'DELETE',
      }, accessToken);

      expect(response.status).toBe(200);

      const getRes = await authenticatedRequest(`/tests/${created.id}`, {}, accessToken);
      expect(getRes.status).toBe(404);
    });
  });
});
