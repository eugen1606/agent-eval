import { API_URL, authenticatedRequest, createTestUser } from './support/test-setup';

describe('Auth Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const email = `register-test-${Date.now()}@e2e-test.local`;
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'testpassword123',
          displayName: 'Test User',
        }),
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(email);
      expect(data.user.displayName).toBe('Test User');
      expect(data.tokens).toBeDefined();
      expect(data.tokens.accessToken).toBeDefined();
      expect(data.tokens.refreshToken).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      const email = `duplicate-test-${Date.now()}@e2e-test.local`;

      // First registration
      await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'testpassword123' }),
      });

      // Second registration with same email
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'testpassword123' }),
      });

      expect(response.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const email = `login-test-${Date.now()}@e2e-test.local`;
      const password = 'testpassword123';

      // Register first
      await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      // Login
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(email);
      expect(data.tokens.accessToken).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const email = `invalid-login-${Date.now()}@e2e-test.local`;

      await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'correctpassword' }),
      });

      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'wrongpassword' }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user profile', async () => {
      const { user, accessToken } = await createTestUser('-me-test');

      const response = await authenticatedRequest('/auth/me', {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(user.id);
      expect(data.email).toBe(user.email);
    });

    it('should reject unauthenticated request', async () => {
      const response = await fetch(`${API_URL}/auth/me`);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/account/change-password', () => {
    it('should change password successfully', async () => {
      const email = `password-change-${Date.now()}@e2e-test.local`;
      const oldPassword = 'oldpassword123';
      const newPassword = 'newpassword123';

      // Register
      const registerRes = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: oldPassword }),
      });
      const { tokens } = await registerRes.json();

      // Change password
      const response = await authenticatedRequest(
        '/auth/account/change-password',
        {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: oldPassword,
            newPassword: newPassword,
            confirmPassword: newPassword,
          }),
        },
        tokens.accessToken
      );

      expect(response.status).toBe(200);

      // Verify new password works
      const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: newPassword }),
      });

      expect(loginRes.status).toBe(200);
    });

    it('should reject wrong current password', async () => {
      const { accessToken } = await createTestUser('-wrong-password');

      const response = await authenticatedRequest(
        '/auth/account/change-password',
        {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: 'wrongpassword',
            newPassword: 'newpassword123',
            confirmPassword: 'newpassword123',
          }),
        },
        accessToken
      );

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/account/stats', () => {
    it('should return account statistics', async () => {
      const { accessToken } = await createTestUser('-stats-test');

      const response = await authenticatedRequest('/auth/account/stats', {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.stats).toBeDefined();
      expect(data.stats.evaluationsCount).toBeGreaterThanOrEqual(0);
      expect(data.stats.questionSetsCount).toBeGreaterThanOrEqual(0);
      expect(data.stats.flowConfigsCount).toBeGreaterThanOrEqual(0);
      expect(data.stats.accessTokensCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('DELETE /api/auth/account', () => {
    it('should delete account and all related data', async () => {
      const { accessToken } = await createTestUser('-delete-test');

      // Create some data first
      await authenticatedRequest('/questions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Questions',
          questions: [{ question: 'Test?' }],
        }),
      }, accessToken);

      // Delete account
      const response = await authenticatedRequest('/auth/account', {
        method: 'DELETE',
      }, accessToken);

      expect(response.status).toBe(200);

      // Verify token no longer works
      const meResponse = await authenticatedRequest('/auth/me', {}, accessToken);
      expect(meResponse.status).toBe(401);
    });
  });
});
