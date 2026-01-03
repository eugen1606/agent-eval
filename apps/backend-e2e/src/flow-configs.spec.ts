import { authenticatedRequest, createTestUser } from './support/test-setup';

describe('Flow Configs CRUD', () => {
  let accessToken: string;

  beforeAll(async () => {
    const auth = await createTestUser('-flow-configs');
    accessToken = auth.accessToken;
  });

  describe('POST /api/flow-configs', () => {
    it('should create a flow config', async () => {
      const response = await authenticatedRequest('/flow-configs', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Flow Config',
          flowId: 'test-flow-123',
          basePath: 'https://api.example.com',
          description: 'A test flow configuration',
        }),
      }, accessToken);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Test Flow Config');
      expect(data.flowId).toBe('test-flow-123');
      expect(data.basePath).toBe('https://api.example.com');
    });
  });

  describe('GET /api/flow-configs', () => {
    it('should list flow configs', async () => {
      await authenticatedRequest('/flow-configs', {
        method: 'POST',
        body: JSON.stringify({
          name: 'List Test Config',
          flowId: 'list-flow-123',
        }),
      }, accessToken);

      const response = await authenticatedRequest('/flow-configs', {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/flow-configs/:id', () => {
    it('should get a single flow config', async () => {
      const createRes = await authenticatedRequest('/flow-configs', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Get Test Config',
          flowId: 'get-flow-123',
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/flow-configs/${created.id}`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.name).toBe('Get Test Config');
    });
  });

  describe('PUT /api/flow-configs/:id', () => {
    it('should update a flow config', async () => {
      const createRes = await authenticatedRequest('/flow-configs', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Update Test Config',
          flowId: 'update-flow-123',
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/flow-configs/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Config Name',
          flowId: 'updated-flow-456',
        }),
      }, accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.name).toBe('Updated Config Name');
      expect(data.flowId).toBe('updated-flow-456');
    });
  });

  describe('DELETE /api/flow-configs/:id', () => {
    it('should delete a flow config', async () => {
      const createRes = await authenticatedRequest('/flow-configs', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Delete Test Config',
          flowId: 'delete-flow-123',
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/flow-configs/${created.id}`, {
        method: 'DELETE',
      }, accessToken);

      expect(response.status).toBe(200);

      const getRes = await authenticatedRequest(`/flow-configs/${created.id}`, {}, accessToken);
      expect(getRes.status).toBe(404);
    });
  });
});
