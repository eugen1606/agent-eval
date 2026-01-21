import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';

describe('Tests CRUD', () => {
  let accessToken: string;
  let flowConfigId: string;

  beforeAll(async () => {
    const auth = await createTestUser('-tests');
    accessToken = auth.accessToken;

    // Create a FlowConfig to use in tests
    const fcResponse = await authenticatedRequest('/flow-configs', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Flow Config',
        flowId: 'test-flow-123',
        basePath: 'https://api.example.com',
      }),
    }, accessToken);
    const fcData = await fcResponse.json();
    flowConfigId = fcData.id;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken);
  });

  describe('POST /api/tests', () => {
    it('should create a test with flowConfigId', async () => {
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Flow Evaluation',
          description: 'A test for evaluating flow responses',
          flowConfigId: flowConfigId,
          multiStepEvaluation: false,
        }),
      }, accessToken);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Test Flow Evaluation');
      expect(data.flowConfigId).toBe(flowConfigId);
      expect(data.multiStepEvaluation).toBe(false);
    });

    it('should require flowConfigId', async () => {
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test without FlowConfig',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
    });

    it('should reject invalid flowConfigId', async () => {
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test with invalid FlowConfig',
          flowConfigId: '00000000-0000-0000-0000-000000000000',
        }),
      }, accessToken);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/tests', () => {
    it('should list tests with pagination', async () => {
      const response = await authenticatedRequest('/tests', {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
    });
  });

  describe('GET /api/tests/:id', () => {
    it('should get a single test with flowConfig relation', async () => {
      const createRes = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Get Test With FlowConfig',
          flowConfigId: flowConfigId,
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/tests/${created.id}`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.name).toBe('Get Test With FlowConfig');
      expect(data.flowConfigId).toBe(flowConfigId);
      expect(data.flowConfig).toBeDefined();
      expect(data.flowConfig.flowId).toBe('test-flow-123');
      expect(data.flowConfig.basePath).toBe('https://api.example.com');
    });

    it('should return 404 for non-existent test', async () => {
      const response = await authenticatedRequest('/tests/00000000-0000-0000-0000-000000000000', {}, accessToken);
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/tests/:id', () => {
    it('should update a test', async () => {
      const createRes = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Update Test',
          flowConfigId: flowConfigId,
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

    it('should update flowConfigId', async () => {
      // Create a second flow config
      const fc2Res = await authenticatedRequest('/flow-configs', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Second Flow Config',
          flowId: 'second-flow',
          basePath: 'https://api2.example.com',
        }),
      }, accessToken);
      const fc2 = await fc2Res.json();

      const createRes = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test to Update FlowConfig',
          flowConfigId: flowConfigId,
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/tests/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          flowConfigId: fc2.id,
        }),
      }, accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.flowConfigId).toBe(fc2.id);
      expect(data.flowConfig.flowId).toBe('second-flow');
    });
  });

  describe('DELETE /api/tests/:id', () => {
    it('should delete a test', async () => {
      const createRes = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Delete Test',
          flowConfigId: flowConfigId,
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

  describe('FlowConfig SET NULL behavior', () => {
    it('should set flowConfigId to null when FlowConfig is deleted', async () => {
      // Create a new FlowConfig
      const fcRes = await authenticatedRequest('/flow-configs', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Deletable Flow Config',
          flowId: 'delete-test-flow',
          basePath: 'https://delete.example.com',
        }),
      }, accessToken);
      const fc = await fcRes.json();

      // Create a test using it
      const testRes = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test for SET NULL',
          flowConfigId: fc.id,
        }),
      }, accessToken);
      const test = await testRes.json();

      // Delete the FlowConfig
      await authenticatedRequest(`/flow-configs/${fc.id}`, {
        method: 'DELETE',
      }, accessToken);

      // Verify test still exists but flowConfigId is null
      const getRes = await authenticatedRequest(`/tests/${test.id}`, {}, accessToken);
      expect(getRes.status).toBe(200);
      const updatedTest = await getRes.json();
      expect(updatedTest.flowConfigId).toBeNull();
      expect(updatedTest.flowConfig).toBeNull();
    });
  });
});
