import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';
import { createAccessToken } from './support/factories';
import { expectPaginatedList, expectDeleteAndVerify } from './support/assertions';

describe('Access Tokens CRUD', () => {
  let accessToken: string;
  let csrfToken: string;

  beforeAll(async () => {
    const auth = await createTestUser('-access-tokens');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  describe('POST /api/access-tokens', () => {
    it('should create an access token', async () => {
      const data = await createAccessToken(accessToken, {
        name: 'Test API Token',
        token: 'super-secret-token-value',
        description: 'A test API token',
      });

      expect(data.name).toBe('Test API Token');
      expect(data.description).toBe('A test API token');
      // Token should not be exposed
      expect(data.token).toBeUndefined();
      expect(data.encryptedToken).toBeUndefined();
    });
  });

  describe('GET /api/access-tokens', () => {
    it('should list access tokens without exposing token values', async () => {
      await createAccessToken(accessToken, {
        name: 'List Test Token',
        token: 'list-test-token-value',
      });

      const response = await authenticatedRequest('/access-tokens', {}, accessToken);
      const result = await expectPaginatedList(response, { minLength: 1 });

      // Verify no token values are exposed
      result.data.forEach((token: Record<string, unknown>) => {
        expect(token.token).toBeUndefined();
        expect(token.encryptedToken).toBeUndefined();
      });
    });
  });

  describe('GET /api/access-tokens/:id', () => {
    it('should get a single access token', async () => {
      const created = await createAccessToken(accessToken, {
        name: 'Get Test Token',
        token: 'get-test-token-value',
      });

      const response = await authenticatedRequest(`/access-tokens/${created.id}`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.name).toBe('Get Test Token');
    });
  });

  describe('PUT /api/access-tokens/:id', () => {
    it('should update an access token', async () => {
      const created = await createAccessToken(accessToken, {
        name: 'Update Test Token',
        token: 'original-token-value',
      });

      const response = await authenticatedRequest(`/access-tokens/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Token Name',
        }),
      }, accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.name).toBe('Updated Token Name');
    });

    it('should update token value', async () => {
      const created = await createAccessToken(accessToken, {
        name: 'Token Value Update Test',
        token: 'original-token',
      });

      const response = await authenticatedRequest(`/access-tokens/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          token: 'new-token-value',
        }),
      }, accessToken);

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/access-tokens/:id', () => {
    it('should delete an access token', async () => {
      const created = await createAccessToken(accessToken, {
        name: 'Delete Test Token',
        token: 'delete-test-token',
      });

      await expectDeleteAndVerify('/access-tokens', created.id as string, accessToken);
    });
  });
});
