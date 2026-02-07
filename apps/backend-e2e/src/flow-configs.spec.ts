import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';
import { createFlowConfig } from './support/factories';
import { expectPaginatedList, expectDeleteAndVerify } from './support/assertions';

describe('Flow Configs CRUD', () => {
  let accessToken: string;
  let csrfToken: string;

  beforeAll(async () => {
    const auth = await createTestUser('-flow-configs');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  describe('POST /api/flow-configs', () => {
    it('should create a flow config', async () => {
      const data = await createFlowConfig(accessToken, {
        description: 'A test flow configuration',
      });

      expect(data.name).toBe('Test Flow Config');
      expect(data.flowId).toBe('test-flow-123');
      expect(data.basePath).toBe('https://api.example.com');
    });
  });

  describe('GET /api/flow-configs', () => {
    it('should list flow configs', async () => {
      await createFlowConfig(accessToken, {
        name: 'List Test Config',
        flowId: 'list-flow-123',
      });

      const response = await authenticatedRequest('/flow-configs', {}, accessToken);
      await expectPaginatedList(response, { minLength: 1 });
    });
  });

  describe('GET /api/flow-configs/:id', () => {
    it('should get a single flow config', async () => {
      const created = await createFlowConfig(accessToken, {
        name: 'Get Test Config',
        flowId: 'get-flow-123',
      });

      const response = await authenticatedRequest(`/flow-configs/${created.id}`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.name).toBe('Get Test Config');
    });
  });

  describe('PUT /api/flow-configs/:id', () => {
    it('should update a flow config', async () => {
      const created = await createFlowConfig(accessToken, {
        name: 'Update Test Config',
        flowId: 'update-flow-123',
      });

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
      const created = await createFlowConfig(accessToken, {
        name: 'Delete Test Config',
        flowId: 'delete-flow-123',
      });

      await expectDeleteAndVerify('/flow-configs', created.id as string, accessToken);
    });
  });
});
