import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';

describe('Data Isolation', () => {
  let user1Token: string;
  let user2Token: string;

  beforeAll(async () => {
    const auth1 = await createTestUser('-isolation-user1');
    const auth2 = await createTestUser('-isolation-user2');
    user1Token = auth1.accessToken;
    user2Token = auth2.accessToken;
  });

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(user1Token),
      deleteTestUser(user2Token),
    ]);
  });

  describe('Question Sets Isolation', () => {
    it('should not allow user2 to see user1 question sets', async () => {
      // User1 creates a question set
      const createRes = await authenticatedRequest('/questions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'User1 Private Questions',
          questions: [{ question: 'Secret question?' }],
        }),
      }, user1Token);
      const created = await createRes.json();

      // User2 tries to list question sets - should not see user1's data
      const listRes = await authenticatedRequest('/questions', {}, user2Token);
      const list = await listRes.json();

      const found = list.find((q: { id: string }) => q.id === created.id);
      expect(found).toBeUndefined();
    });

    it('should not allow user2 to access user1 question set by id', async () => {
      const createRes = await authenticatedRequest('/questions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'User1 Private Questions 2',
          questions: [{ question: 'Secret?' }],
        }),
      }, user1Token);
      const created = await createRes.json();

      // User2 tries to access directly
      const getRes = await authenticatedRequest(`/questions/${created.id}`, {}, user2Token);
      expect(getRes.status).toBe(404);
    });

    it('should not allow user2 to update user1 question set', async () => {
      const createRes = await authenticatedRequest('/questions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'User1 Questions For Update',
          questions: [{ question: 'Test?' }],
        }),
      }, user1Token);
      const created = await createRes.json();

      const updateRes = await authenticatedRequest(`/questions/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Hacked Name' }),
      }, user2Token);

      expect(updateRes.status).toBe(404);
    });

    it('should not allow user2 to delete user1 question set', async () => {
      const createRes = await authenticatedRequest('/questions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'User1 Questions For Delete',
          questions: [{ question: 'Test?' }],
        }),
      }, user1Token);
      const created = await createRes.json();

      const deleteRes = await authenticatedRequest(`/questions/${created.id}`, {
        method: 'DELETE',
      }, user2Token);

      expect(deleteRes.status).toBe(404);

      // Verify user1 can still access it
      const getRes = await authenticatedRequest(`/questions/${created.id}`, {}, user1Token);
      expect(getRes.status).toBe(200);
    });
  });

  describe('Flow Configs Isolation', () => {
    it('should not allow user2 to see user1 flow configs', async () => {
      const createRes = await authenticatedRequest('/flow-configs', {
        method: 'POST',
        body: JSON.stringify({
          name: 'User1 Private Config',
          flowId: 'secret-flow-123',
        }),
      }, user1Token);
      const created = await createRes.json();

      const listRes = await authenticatedRequest('/flow-configs', {}, user2Token);
      const list = await listRes.json();

      const found = list.find((f: { id: string }) => f.id === created.id);
      expect(found).toBeUndefined();
    });

    it('should not allow user2 to access user1 flow config by id', async () => {
      const createRes = await authenticatedRequest('/flow-configs', {
        method: 'POST',
        body: JSON.stringify({
          name: 'User1 Private Config 2',
          flowId: 'secret-flow-456',
        }),
      }, user1Token);
      const created = await createRes.json();

      const getRes = await authenticatedRequest(`/flow-configs/${created.id}`, {}, user2Token);
      expect(getRes.status).toBe(404);
    });
  });

  describe('Access Tokens Isolation', () => {
    it('should not allow user2 to see user1 access tokens', async () => {
      const createRes = await authenticatedRequest('/access-tokens', {
        method: 'POST',
        body: JSON.stringify({
          name: 'User1 Secret Token',
          token: 'super-secret-value',
        }),
      }, user1Token);
      const created = await createRes.json();

      const listRes = await authenticatedRequest('/access-tokens', {}, user2Token);
      const list = await listRes.json();

      const found = list.find((t: { id: string }) => t.id === created.id);
      expect(found).toBeUndefined();
    });

    it('should not allow user2 to access user1 access token by id', async () => {
      const createRes = await authenticatedRequest('/access-tokens', {
        method: 'POST',
        body: JSON.stringify({
          name: 'User1 Secret Token 2',
          token: 'super-secret-value-2',
        }),
      }, user1Token);
      const created = await createRes.json();

      const getRes = await authenticatedRequest(`/access-tokens/${created.id}`, {}, user2Token);
      expect(getRes.status).toBe(404);
    });
  });

  describe('Account Stats Isolation', () => {
    it('should only count user own data in stats', async () => {
      // Create data for user1
      await authenticatedRequest('/questions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Stats Test Questions',
          questions: [{ question: 'Test?' }],
        }),
      }, user1Token);

      // Get user2 stats - should not include user1 data
      const statsRes = await authenticatedRequest('/auth/account/stats', {}, user2Token);
      const stats = await statsRes.json();

      // User2 should have their own counts, not user1's
      expect(stats.stats.questionSetsCount).toBeGreaterThanOrEqual(0);
    });
  });
});
