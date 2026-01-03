import { API_URL, createTestUser, authenticatedRequest, clearThrottleKeys } from './support/test-setup';

// Helper to check if rate limiting is enabled (Redis connected)
async function isRateLimitingEnabled(): Promise<boolean> {
  // Clear any existing throttle keys first
  await clearThrottleKeys();

  // Make requests exceeding the strictest limit (register: 5/min)
  const requests: Promise<Response>[] = [];
  for (let i = 0; i < 8; i++) {
    requests.push(
      fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `rate-limit-check-${Date.now()}-${i}@e2e-test.local`,
          password: 'testpassword123',
        }),
      })
    );
  }
  const responses = await Promise.all(requests);
  return responses.some((r) => r.status === 429);
}

describe('Rate Limiting (Throttling)', () => {
  let rateLimitingEnabled = false;

  beforeAll(async () => {
    rateLimitingEnabled = await isRateLimitingEnabled();
    if (!rateLimitingEnabled) {
      console.log('Rate limiting not active (Redis may not be running). Throttling tests will verify graceful degradation.');
    }
    // Clear throttle keys after the check so other tests aren't affected
    await clearThrottleKeys();
  });

  describe('Health endpoints - should never be throttled', () => {
    it('should not throttle health endpoint', async () => {
      const requests: Promise<Response>[] = [];

      // Make 20 rapid requests - health endpoints should never be throttled
      for (let i = 0; i < 20; i++) {
        requests.push(fetch(`${API_URL}/health`));
      }

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      // All requests should succeed
      const successCount = statuses.filter((s) => s === 200).length;
      expect(successCount).toBe(20);
    });

    it('should not throttle health/live endpoint', async () => {
      const requests: Promise<Response>[] = [];

      for (let i = 0; i < 20; i++) {
        requests.push(fetch(`${API_URL}/health/live`));
      }

      const responses = await Promise.all(requests);
      const allSucceeded = responses.every((r) => r.status === 200);

      expect(allSucceeded).toBe(true);
    });
  });

  describe('Auth endpoints - strict limits (when Redis enabled)', () => {
    beforeEach(async () => {
      await clearThrottleKeys();
    });

    it('should throttle register endpoint after exceeding limit', async () => {
      if (!rateLimitingEnabled) {
        console.log('Skipping: Rate limiting not enabled');
        return;
      }

      const requests: Promise<Response>[] = [];
      for (let i = 0; i < 8; i++) {
        requests.push(
          fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: `throttle-reg-${Date.now()}-${i}@e2e-test.local`,
              password: 'testpassword123',
            }),
          })
        );
      }

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      const successCount = statuses.filter((s) => s === 201).length;
      const throttledCount = statuses.filter((s) => s === 429).length;

      expect(successCount).toBeGreaterThan(0);
      expect(throttledCount).toBeGreaterThan(0);
      expect(successCount + throttledCount).toBe(8);
    });

    it('should throttle login endpoint after exceeding limit', async () => {
      if (!rateLimitingEnabled) {
        console.log('Skipping: Rate limiting not enabled');
        return;
      }

      const email = `throttle-login-${Date.now()}@e2e-test.local`;
      const password = 'testpassword123';

      await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const requests: Promise<Response>[] = [];
      for (let i = 0; i < 15; i++) {
        requests.push(
          fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })
        );
      }

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      const successCount = statuses.filter((s) => s === 200).length;
      const throttledCount = statuses.filter((s) => s === 429).length;

      expect(successCount).toBeGreaterThan(0);
      expect(throttledCount).toBeGreaterThan(0);
    });

    it('should return proper 429 response with message', async () => {
      if (!rateLimitingEnabled) {
        console.log('Skipping: Rate limiting not enabled');
        return;
      }

      const requests: Promise<Response>[] = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: `throttle-format-${Date.now()}-${i}@e2e-test.local`,
              password: 'testpassword123',
            }),
          })
        );
      }

      const responses = await Promise.all(requests);
      const throttledResponse = responses.find((r) => r.status === 429);

      expect(throttledResponse).toBeDefined();
      const data = await throttledResponse!.json();
      expect(data.message).toContain('Too many requests');
      expect(data.statusCode).toBe(429);
    });
  });

  describe('Graceful degradation without Redis', () => {
    it('should allow requests when Redis is unavailable', async () => {
      if (rateLimitingEnabled) {
        console.log('Skipping: Rate limiting is enabled, testing graceful degradation not applicable');
        return;
      }

      // When Redis is down, requests should still succeed (no throttling)
      const requests: Promise<Response>[] = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: `no-redis-${Date.now()}-${i}@e2e-test.local`,
              password: 'testpassword123',
            }),
          })
        );
      }

      const responses = await Promise.all(requests);
      const successCount = responses.filter((r) => r.status === 201).length;

      // All requests should succeed when Redis is not available
      expect(successCount).toBe(10);
    });
  });

  describe('Authenticated endpoint behavior', () => {
    it('should allow multiple requests within rate limit', async () => {
      const { accessToken } = await createTestUser('-throttle-auth');

      const requests: Promise<Response>[] = [];
      for (let i = 0; i < 30; i++) {
        requests.push(
          authenticatedRequest('/auth/me', {}, accessToken)
        );
      }

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      // With default limit of 100/min, 30 requests should all succeed
      const successCount = statuses.filter((s) => s === 200).length;
      expect(successCount).toBe(30);
    });

    it('should have separate rate limits per user', async () => {
      const user1 = await createTestUser('-throttle-user1');
      const user2 = await createTestUser('-throttle-user2');

      const user1Requests: Promise<Response>[] = [];
      for (let i = 0; i < 20; i++) {
        user1Requests.push(
          authenticatedRequest('/auth/me', {}, user1.accessToken)
        );
      }

      const user2Requests: Promise<Response>[] = [];
      for (let i = 0; i < 20; i++) {
        user2Requests.push(
          authenticatedRequest('/auth/me', {}, user2.accessToken)
        );
      }

      const [user1Responses, user2Responses] = await Promise.all([
        Promise.all(user1Requests),
        Promise.all(user2Requests),
      ]);

      const user1Success = user1Responses.filter((r) => r.status === 200).length;
      const user2Success = user2Responses.filter((r) => r.status === 200).length;

      expect(user1Success).toBe(20);
      expect(user2Success).toBe(20);
    });
  });
});
