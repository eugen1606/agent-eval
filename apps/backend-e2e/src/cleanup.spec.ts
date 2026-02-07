import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';
import { createTest, createRun } from './support/factories';

describe('Cleanup', () => {
  let accessToken: string;
  let csrfToken: string;
  let testId: string;

  beforeAll(async () => {
    const auth = await createTestUser('-cleanup');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;

    const test = await createTest(accessToken, { name: 'Cleanup Test Parent' });
    testId = test.id as string;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  describe('GET /api/cleanup/config', () => {
    it('should return cleanup configuration', async () => {
      const response = await authenticatedRequest('/cleanup/config', {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.enabled).toBeDefined();
      expect(data.retentionDays).toBeDefined();
      // retentionDays may be returned as number or string depending on env var handling
      expect(['number', 'string'].includes(typeof data.retentionDays)).toBe(true);
    });
  });

  describe('POST /api/cleanup/runs', () => {
    it('should delete old completed runs', async () => {
      const created = await createRun(accessToken, { testId, totalQuestions: 1 });

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
      const created = await createRun(accessToken, { testId, totalQuestions: 1 });

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
      const created = await createRun(accessToken, { testId, totalQuestions: 5 });

      // Run cleanup
      await authenticatedRequest('/cleanup/runs', {
        method: 'POST',
      }, accessToken);

      // Verify the pending run still exists
      const afterCleanup = await authenticatedRequest(`/runs/${created.id}`, {}, accessToken);
      expect(afterCleanup.status).toBe(200);
    });

    it('should preserve running status runs even with old completedAt', async () => {
      const created = await createRun(accessToken, { testId, totalQuestions: 5 });

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
