import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';
import { createFlowConfig, createTest } from './support/factories';
import {
  NON_EXISTENT_UUID,
  expectNotFound,
  expectPaginatedList,
  expectDeleteAndVerify,
} from './support/assertions';

describe('Tests CRUD', () => {
  let accessToken: string;
  let csrfToken: string;
  let flowConfigId: string;

  beforeAll(async () => {
    const auth = await createTestUser('-tests');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;

    const fc = await createFlowConfig(accessToken);
    flowConfigId = fc.id as string;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  describe('POST /api/tests', () => {
    it('should create a test with flowConfigId', async () => {
      const data = await createTest(accessToken, {
        name: 'Test Flow Evaluation',
        description: 'A test for evaluating flow responses',
        flowConfigId,
        multiStepEvaluation: false,
      });

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
          flowConfigId: NON_EXISTENT_UUID,
        }),
      }, accessToken);

      expectNotFound(response);
    });
  });

  describe('GET /api/tests', () => {
    it('should list tests with pagination', async () => {
      const response = await authenticatedRequest('/tests', {}, accessToken);
      const result = await expectPaginatedList(response);
      expect(result.pagination.page).toBe(1);
    });
  });

  describe('GET /api/tests/:id', () => {
    it('should get a single test with flowConfig relation', async () => {
      const created = await createTest(accessToken, {
        name: 'Get Test With FlowConfig',
        flowConfigId,
      });

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
      const response = await authenticatedRequest(`/tests/${NON_EXISTENT_UUID}`, {}, accessToken);
      expectNotFound(response);
    });
  });

  describe('PUT /api/tests/:id', () => {
    it('should update a test', async () => {
      const created = await createTest(accessToken, {
        name: 'Update Test',
        flowConfigId,
      });

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
      const fc2 = await createFlowConfig(accessToken, {
        name: 'Second Flow Config',
        flowId: 'second-flow',
        basePath: 'https://api2.example.com',
      });

      const created = await createTest(accessToken, {
        name: 'Test to Update FlowConfig',
        flowConfigId,
      });

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
      const created = await createTest(accessToken, {
        name: 'Delete Test',
        flowConfigId,
      });

      await expectDeleteAndVerify('/tests', created.id as string, accessToken);
    });
  });

  describe('repeatCount', () => {
    it('should create a test with repeatCount', async () => {
      const data = await createTest(accessToken, {
        name: 'Test with Repeat',
        flowConfigId,
        repeatCount: 5,
      });

      expect(data.repeatCount).toBe(5);
    });

    it('should default repeatCount to 1', async () => {
      const data = await createTest(accessToken, {
        name: 'Test Default Repeat',
        flowConfigId,
      });

      expect(data.repeatCount).toBe(1);
    });

    it('should reject repeatCount less than 1', async () => {
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Invalid Repeat',
          flowConfigId,
          repeatCount: 0,
        }),
      }, accessToken);

      expect(response.status).toBe(400);
    });

    it('should reject repeatCount greater than 50', async () => {
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Invalid Repeat High',
          flowConfigId,
          repeatCount: 51,
        }),
      }, accessToken);

      expect(response.status).toBe(400);
    });

    it('should update repeatCount', async () => {
      const created = await createTest(accessToken, {
        name: 'Test Update Repeat',
        flowConfigId,
      });

      const response = await authenticatedRequest(`/tests/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({ repeatCount: 10 }),
      }, accessToken);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.repeatCount).toBe(10);
    });
  });

  describe('FlowConfig SET NULL behavior', () => {
    it('should set flowConfigId to null when FlowConfig is deleted', async () => {
      const fc = await createFlowConfig(accessToken, {
        name: 'Deletable Flow Config',
        flowId: 'delete-test-flow',
        basePath: 'https://delete.example.com',
      });

      const test = await createTest(accessToken, {
        name: 'Test for SET NULL',
        flowConfigId: fc.id,
      });

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
