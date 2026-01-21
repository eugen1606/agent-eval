import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';

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
      const response = await authenticatedRequest('/access-tokens', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test API Token',
          token: 'super-secret-token-value',
          description: 'A test API token',
        }),
      }, accessToken);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Test API Token');
      expect(data.description).toBe('A test API token');
      // Token should not be exposed
      expect(data.token).toBeUndefined();
      expect(data.encryptedToken).toBeUndefined();
    });
  });

  describe('GET /api/access-tokens', () => {
    it('should list access tokens without exposing token values', async () => {
      await authenticatedRequest('/access-tokens', {
        method: 'POST',
        body: JSON.stringify({
          name: 'List Test Token',
          token: 'list-test-token-value',
        }),
      }, accessToken);

      const response = await authenticatedRequest('/access-tokens', {}, accessToken);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.pagination).toBeDefined();

      // Verify no token values are exposed
      result.data.forEach((token: Record<string, unknown>) => {
        expect(token.token).toBeUndefined();
        expect(token.encryptedToken).toBeUndefined();
      });
    });
  });

  describe('GET /api/access-tokens/:id', () => {
    it('should get a single access token', async () => {
      const createRes = await authenticatedRequest('/access-tokens', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Get Test Token',
          token: 'get-test-token-value',
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/access-tokens/${created.id}`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.name).toBe('Get Test Token');
    });
  });

  describe('PUT /api/access-tokens/:id', () => {
    it('should update an access token', async () => {
      const createRes = await authenticatedRequest('/access-tokens', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Update Test Token',
          token: 'original-token-value',
        }),
      }, accessToken);
      const created = await createRes.json();

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
      const createRes = await authenticatedRequest('/access-tokens', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Token Value Update Test',
          token: 'original-token',
        }),
      }, accessToken);
      const created = await createRes.json();

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
      const createRes = await authenticatedRequest('/access-tokens', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Delete Test Token',
          token: 'delete-test-token',
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/access-tokens/${created.id}`, {
        method: 'DELETE',
      }, accessToken);

      expect(response.status).toBe(200);

      const getRes = await authenticatedRequest(`/access-tokens/${created.id}`, {}, accessToken);
      expect(getRes.status).toBe(404);
    });
  });
});
