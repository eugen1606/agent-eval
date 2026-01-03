import { API_URL } from './support/test-setup';

describe('Health Endpoints', () => {
  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${API_URL}/health`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeGreaterThanOrEqual(0);
      expect(data.version).toBeDefined();
    });
  });

  describe('GET /api/health/live', () => {
    it('should return liveness status', async () => {
      const response = await fetch(`${API_URL}/health/live`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('healthy');
    });
  });

  describe('GET /api/health/ready', () => {
    it('should return readiness status with database check', async () => {
      const response = await fetch(`${API_URL}/health/ready`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.checks).toBeDefined();
      expect(data.checks.database).toBeDefined();
      expect(data.checks.database.status).toBe('up');
      expect(data.checks.database.responseTime).toBeGreaterThanOrEqual(0);
    });
  });
});
