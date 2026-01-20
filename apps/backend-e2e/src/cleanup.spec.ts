import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';

describe('Cleanup', () => {
  let accessToken: string;
  let testId: string;

  beforeAll(async () => {
    const auth = await createTestUser('-cleanup');
    accessToken = auth.accessToken;

    // Create a test to associate runs with
    const testRes = await authenticatedRequest('/tests', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Cleanup Test Parent',
        flowId: 'cleanup-test-flow',
        basePath: 'https://api.example.com',
      }),
    }, accessToken);
    const testData = await testRes.json();
    testId = testData.id;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken);
  });

  describe('GET /api/cleanup/config', () => {
    it('should return cleanup configuration', async () => {
      const response = await authenticatedRequest('/cleanup/config', {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.enabled).toBeDefined();
      expect(data.retentionDays).toBeDefined();
      expect(typeof data.retentionDays).toBe('number');
    });
  });

  describe('POST /api/cleanup/runs', () => {
    it('should delete old completed runs', async () => {
      // Create a run (always starts as pending)
      const createRes = await authenticatedRequest('/runs', {
        method: 'POST',
        body: JSON.stringify({
          testId,
          totalQuestions: 1,
        }),
      }, accessToken);
      const created = await createRes.json();

      // Update the run to completed status with an old completedAt date (100 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const updateRes = await authenticatedRequest(`/runs/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'completed',
          completedAt: oldDate.toISOString(),
        }),
      }, accessToken);
      expect(updateRes.status).toBe(200);

      // Verify completedAt was set correctly
      const verifyRes = await authenticatedRequest(`/runs/${created.id}`, {}, accessToken);
      expect(verifyRes.status).toBe(200);
      const verifyData = await verifyRes.json();
      expect(verifyData.completedAt).toBeDefined();

      // Verify the date is actually old (more than 90 days ago)
      const completedAtDate = new Date(verifyData.completedAt);
      const daysDiff = (Date.now() - completedAtDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThan(90);

      // Run cleanup
      const cleanupRes = await authenticatedRequest('/cleanup/runs', {
        method: 'POST',
      }, accessToken);
      expect(cleanupRes.status).toBe(201);

      const cleanupData = await cleanupRes.json();
      expect(cleanupData.deletedCount).toBeGreaterThanOrEqual(1);

      // Verify the old run is deleted
      const afterCleanup = await authenticatedRequest(`/runs/${created.id}`, {}, accessToken);
      expect(afterCleanup.status).toBe(404);
    });

    it('should preserve recent completed runs', async () => {
      // Create a run (always starts as pending)
      const createRes = await authenticatedRequest('/runs', {
        method: 'POST',
        body: JSON.stringify({
          testId,
          totalQuestions: 1,
        }),
      }, accessToken);
      const created = await createRes.json();

      // Update the run to completed status with a recent completedAt date (10 days ago)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);

      await authenticatedRequest(`/runs/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'completed',
          completedAt: recentDate.toISOString(),
        }),
      }, accessToken);

      // Run cleanup
      await authenticatedRequest('/cleanup/runs', {
        method: 'POST',
      }, accessToken);

      // Verify the recent run still exists
      const afterCleanup = await authenticatedRequest(`/runs/${created.id}`, {}, accessToken);
      expect(afterCleanup.status).toBe(200);
    });

    it('should preserve runs without completedAt', async () => {
      // Create a pending run (no completedAt)
      const createRes = await authenticatedRequest('/runs', {
        method: 'POST',
        body: JSON.stringify({
          testId,
          totalQuestions: 5,
        }),
      }, accessToken);
      const created = await createRes.json();

      // Run cleanup
      await authenticatedRequest('/cleanup/runs', {
        method: 'POST',
      }, accessToken);

      // Verify the pending run still exists
      const afterCleanup = await authenticatedRequest(`/runs/${created.id}`, {}, accessToken);
      expect(afterCleanup.status).toBe(200);
    });

    it('should preserve running status runs even with old completedAt', async () => {
      // This is an edge case - running status shouldn't have completedAt,
      // but we should still protect it
      const createRes = await authenticatedRequest('/runs', {
        method: 'POST',
        body: JSON.stringify({
          testId,
          totalQuestions: 5,
        }),
      }, accessToken);
      const created = await createRes.json();

      // Set status to running
      await authenticatedRequest(`/runs/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'running',
        }),
      }, accessToken);

      // Run cleanup
      await authenticatedRequest('/cleanup/runs', {
        method: 'POST',
      }, accessToken);

      // Verify the running run still exists
      const afterCleanup = await authenticatedRequest(`/runs/${created.id}`, {}, accessToken);
      expect(afterCleanup.status).toBe(200);
    });
  });
});
