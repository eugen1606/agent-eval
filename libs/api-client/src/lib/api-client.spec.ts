// Mock document.cookie for CSRF token tests - must be before importing the module
const mockDocumentCookie = {
  value: '',
};

// Create mock document if it doesn't exist (Node environment)
if (typeof document === 'undefined') {
  (global as any).document = {
    cookie: '',
  };
}

Object.defineProperty(global.document, 'cookie', {
  get: () => mockDocumentCookie.value,
  set: (v: string) => {
    mockDocumentCookie.value = v;
  },
  configurable: true,
});

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Now import the module after mocks are set up
import { AgentEvalClient, createClient } from './api-client';

describe('AgentEvalClient', () => {
  let client: AgentEvalClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocumentCookie.value = '';
    client = new AgentEvalClient('http://localhost:3001/api');
  });

  describe('constructor', () => {
    it('should use default API URL when not provided', () => {
      const defaultClient = new AgentEvalClient();
      expect(defaultClient.getApiUrl()).toBe('http://localhost:3001/api');
    });

    it('should use provided API URL', () => {
      const customClient = new AgentEvalClient('http://custom:8080/api');
      expect(customClient.getApiUrl()).toBe('http://custom:8080/api');
    });

    it('should load CSRF token from cookie on initialization', () => {
      mockDocumentCookie.value = 'csrf_token=test-csrf-token';
      const clientWithCookie = new AgentEvalClient();
      expect(clientWithCookie.isAuthenticated()).toBe(true);
      expect(clientWithCookie.getAuthToken()).toBe('test-csrf-token');
    });
  });

  describe('createClient factory', () => {
    it('should create a client instance', () => {
      const factoryClient = createClient('http://test:3000/api');
      expect(factoryClient).toBeInstanceOf(AgentEvalClient);
      expect(factoryClient.getApiUrl()).toBe('http://test:3000/api');
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no CSRF token', () => {
      expect(client.isAuthenticated()).toBe(false);
    });

    it('should return true when CSRF token exists in cookie', () => {
      mockDocumentCookie.value = 'csrf_token=abc123';
      expect(client.isAuthenticated()).toBe(true);
    });

    it('should reload CSRF token from cookie', () => {
      expect(client.isAuthenticated()).toBe(false);
      mockDocumentCookie.value = 'csrf_token=new-token';
      expect(client.isAuthenticated()).toBe(true);
    });
  });

  describe('getAuthToken', () => {
    it('should return null when no CSRF token', () => {
      expect(client.getAuthToken()).toBeNull();
    });

    it('should return CSRF token from cookie', () => {
      mockDocumentCookie.value = 'csrf_token=my-token; other=value';
      expect(client.getAuthToken()).toBe('my-token');
    });
  });

  describe('setOnAuthChange', () => {
    it('should call callback on login success', async () => {
      const authChangeSpy = jest.fn();
      client.setOnAuthChange(authChangeSpy);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              user: { id: '1', email: 'test@test.com' },
              csrfToken: 'new-csrf',
            })
          ),
      });

      await client.login({ email: 'test@test.com', password: 'password' });
      expect(authChangeSpy).toHaveBeenCalledWith(true);
    });

    it('should call callback on logout', async () => {
      const authChangeSpy = jest.fn();
      client.setOnAuthChange(authChangeSpy);

      mockFetch.mockResolvedValueOnce({ ok: true });

      await client.logout();
      expect(authChangeSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('login', () => {
    it('should send login request with credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              user: { id: '1', email: 'test@test.com' },
              csrfToken: 'csrf-123',
            })
          ),
      });

      const result = await client.login({
        email: 'test@test.com',
        password: 'password123',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.data?.user.email).toBe('test@test.com');
    });

    it('should set CSRF token from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              user: { id: '1', email: 'test@test.com' },
              csrfToken: 'new-csrf-token',
            })
          ),
      });

      await client.login({ email: 'test@test.com', password: 'pass' });

      // The internal csrfToken should be set
      // We can verify by checking that subsequent requests include it
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ id: '1' })),
      });

      await client.createTest({ name: 'Test', flowConfigId: 'fc-1' });

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/tests',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-Token': 'new-csrf-token',
          }),
        })
      );
    });

    it('should return error on failed login', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve(JSON.stringify({ message: 'Invalid credentials' })),
      });

      const result = await client.login({
        email: 'test@test.com',
        password: 'wrong',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });
  });

  describe('register', () => {
    it('should send register request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              user: { id: '1', email: 'new@test.com' },
              csrfToken: 'csrf-reg',
            })
          ),
      });

      const result = await client.register({
        email: 'new@test.com',
        password: 'password123',
        displayName: 'Test User',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/auth/register',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'new@test.com',
            password: 'password123',
            displayName: 'Test User',
          }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('should set CSRF token on successful registration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              user: { id: '1', email: 'new@test.com' },
              csrfToken: 'reg-csrf',
            })
          ),
      });

      await client.register({ email: 'new@test.com', password: 'pass' });

      // Verify CSRF token is used in subsequent requests
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({})),
      });

      await client.deleteTest('test-id');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/tests/test-id',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-Token': 'reg-csrf',
          }),
        })
      );
    });
  });

  describe('logout', () => {
    it('should call logout endpoint and clear CSRF token', async () => {
      // First login to set token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ user: {}, csrfToken: 'csrf' })),
      });
      await client.login({ email: 'test@test.com', password: 'pass' });

      // Then logout
      mockFetch.mockResolvedValueOnce({ ok: true });
      await client.logout();

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/auth/logout',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });

    it('should handle logout errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Should not throw
      await expect(client.logout()).resolves.not.toThrow();
    });
  });

  describe('getMe', () => {
    it('should fetch current user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({ id: '1', email: 'me@test.com', displayName: 'Me' })
          ),
      });

      const result = await client.getMe();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/auth/me',
        expect.objectContaining({
          credentials: 'include',
        })
      );
      expect(result.success).toBe(true);
      expect(result.data?.email).toBe('me@test.com');
    });
  });

  describe('token refresh', () => {
    it('should refresh token on 401 and retry request', async () => {
      // Set up initial CSRF token
      mockDocumentCookie.value = 'csrf_token=old-token';
      client = new AgentEvalClient('http://localhost:3001/api');

      // First request returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      });

      // Refresh request succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ csrfToken: 'new-csrf-token' }),
      });

      // Update cookie to simulate server setting new token
      mockDocumentCookie.value = 'csrf_token=new-csrf-token';

      // Retry request succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ id: '1', email: 'user@test.com' })),
      });

      const result = await client.getMe();

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'http://localhost:3001/api/auth/refresh',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });

    it('should return session expired error when refresh fails', async () => {
      mockDocumentCookie.value = 'csrf_token=old-token';
      client = new AgentEvalClient('http://localhost:3001/api');

      const authChangeSpy = jest.fn();
      client.setOnAuthChange(authChangeSpy);

      // First request returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      });

      // Refresh request fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await client.getMe();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session expired. Please login again.');
      expect(authChangeSpy).toHaveBeenCalledWith(false);
    });

    it('should handle concurrent refresh requests with mutex', async () => {
      mockDocumentCookie.value = 'csrf_token=token';
      client = new AgentEvalClient('http://localhost:3001/api');

      // Both initial requests return 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('{}'),
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('{}'),
      });

      // Only one refresh should happen
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ csrfToken: 'refreshed' }),
      });

      // Retry requests succeed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ id: '1' })),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ id: '2' })),
      });

      // Make two concurrent requests
      const [result1, result2] = await Promise.all([
        client.getMe(),
        client.getAccountStats(),
      ]);

      // Refresh should only be called once due to mutex
      const refreshCalls = mockFetch.mock.calls.filter(
        (call) => call[0] === 'http://localhost:3001/api/auth/refresh'
      );
      expect(refreshCalls.length).toBe(1);
    });
  });

  describe('CSRF token handling', () => {
    beforeEach(async () => {
      // Login to set CSRF token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ user: {}, csrfToken: 'csrf-token' })),
      });
      await client.login({ email: 'test@test.com', password: 'pass' });
    });

    it('should include CSRF token in POST requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: () => Promise.resolve(JSON.stringify({ id: '1' })),
      });

      await client.createTest({ name: 'Test', flowConfigId: 'fc-1' });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-Token': 'csrf-token',
          }),
        })
      );
    });

    it('should include CSRF token in PUT requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ id: '1' })),
      });

      await client.updateTest('test-id', { name: 'Updated' });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-Token': 'csrf-token',
          }),
        })
      );
    });

    it('should include CSRF token in DELETE requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(''),
      });

      await client.deleteTest('test-id');

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-Token': 'csrf-token',
          }),
        })
      );
    });

    it('should NOT include CSRF token in GET requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ data: [], total: 0 })),
      });

      await client.getTests();

      const lastCallHeaders = mockFetch.mock.calls[
        mockFetch.mock.calls.length - 1
      ][1].headers;
      expect(lastCallHeaders['X-CSRF-Token']).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await client.getMe();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network failure');
    });

    it('should handle non-Error exceptions', async () => {
      mockFetch.mockRejectedValueOnce('string error');

      const result = await client.getMe();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should handle 500 server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Internal server error' })),
      });

      const result = await client.getTests();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal server error');
    });

    it('should handle empty error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve(''),
      });

      const result = await client.getTests();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request failed');
    });
  });

  describe('empty response handling', () => {
    it('should handle 204 No Content responses', async () => {
      mockDocumentCookie.value = 'csrf_token=token';
      client = new AgentEvalClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(''),
      });

      const result = await client.deleteTest('test-id');

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });
  });

  describe('Tests CRUD operations', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ user: {}, csrfToken: 'csrf' })),
      });
      await client.login({ email: 'test@test.com', password: 'pass' });
    });

    it('should create a test', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              id: 'test-1',
              name: 'My Test',
              flowId: 'flow-1',
              basePath: 'http://api',
            })
          ),
      });

      const result = await client.createTest({
        name: 'My Test',
        flowConfigId: 'fc-1',
      });

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('test-1');
    });

    it('should get tests with filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ data: [], total: 0, page: 1, limit: 10 })),
      });

      await client.getTests({
        page: 2,
        limit: 20,
        search: 'keyword',
        sortBy: 'name',
        sortDirection: 'asc',
        questionSetId: 'qs-1',
        accessTokenId: 'at-1',
        multiStep: true,
        tagIds: ['tag-1', 'tag-2'],
      });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('limit=20'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('search=keyword'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('tagIds=tag-1%2Ctag-2'),
        expect.any(Object)
      );
    });

    it('should get a single test', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'test-1', name: 'Test' })),
      });

      const result = await client.getTest('test-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/tests/test-1',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should update a test', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'test-1', name: 'Updated' })),
      });

      const result = await client.updateTest('test-1', { name: 'Updated' });

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/tests/test-1',
        expect.objectContaining({ method: 'PUT' })
      );
      expect(result.success).toBe(true);
    });

    it('should delete a test', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(''),
      });

      const result = await client.deleteTest('test-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/tests/test-1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result.success).toBe(true);
    });

    it('should run a test', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'run-1', status: 'pending' })),
      });

      const result = await client.runTest('test-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/tests/test-1/run',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Runs operations', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ user: {}, csrfToken: 'csrf' })),
      });
      await client.login({ email: 'test@test.com', password: 'pass' });
    });

    it('should create a run', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'run-1', status: 'pending' })),
      });

      const result = await client.createRun({ testId: 'test-1' });

      expect(result.success).toBe(true);
    });

    it('should get runs with filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ data: [], total: 0, page: 1, limit: 10 })),
      });

      await client.getRuns({ status: 'completed', testId: 'test-1' });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('status=completed'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('testId=test-1'),
        expect.any(Object)
      );
    });

    it('should get run stats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ total: 10, correct: 8, partial: 1, incorrect: 1 })),
      });

      const result = await client.getRunStats('run-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/runs/run-1/stats',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should get run performance', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ avgExecutionTime: 1500 })),
      });

      const result = await client.getRunPerformance('run-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/runs/run-1/performance',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should compare runs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ run1: {}, run2: {}, comparison: [] })),
      });

      const result = await client.compareRuns('run-1', 'run-2');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/runs/run-1/compare/run-2',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should update result evaluation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ id: 'run-1', results: [] })),
      });

      const result = await client.updateResultEvaluation('run-1', 'result-1', {
        humanEvaluation: 'correct',
      });

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/runs/run-1/results/result-1/evaluation',
        expect.objectContaining({ method: 'PUT' })
      );
      expect(result.success).toBe(true);
    });

    it('should bulk update result evaluations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ id: 'run-1', results: [] })),
      });

      const result = await client.bulkUpdateResultEvaluations('run-1', [
        { resultId: 'r1', humanEvaluation: 'correct' },
        { resultId: 'r2', humanEvaluation: 'incorrect' },
      ]);

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/runs/run-1/results/evaluations',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            updates: [
              { resultId: 'r1', humanEvaluation: 'correct' },
              { resultId: 'r2', humanEvaluation: 'incorrect' },
            ],
          }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('should cancel a run', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'run-1', status: 'cancelled' })),
      });

      const result = await client.cancelRun('run-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/runs/run-1/cancel',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });

    it('should generate correct run stream URL', () => {
      const url = client.getRunStreamUrl('run-123');
      expect(url).toBe('http://localhost:3001/api/runs/run-123/stream');
    });

    it('should get single run', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'run-1', status: 'completed' })),
      });

      const result = await client.getRun('run-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/runs/run-1',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should update run', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'run-1', status: 'completed' })),
      });

      const result = await client.updateRun('run-1', { status: 'completed' });

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/runs/run-1',
        expect.objectContaining({ method: 'PUT' })
      );
      expect(result.success).toBe(true);
    });

    it('should delete run', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ success: true })),
      });

      const result = await client.deleteRun('run-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/runs/run-1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Access Tokens CRUD', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ user: {}, csrfToken: 'csrf' })),
      });
      await client.login({ email: 'test@test.com', password: 'pass' });
    });

    it('should create access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'token-1', name: 'API Token' })),
      });

      const result = await client.createAccessToken({
        name: 'API Token',
        token: 'secret',
      });

      expect(result.success).toBe(true);
    });

    it('should get access tokens with filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ data: [], total: 0, page: 1, limit: 10 })),
      });

      await client.getAccessTokens({ search: 'api', sortBy: 'name' });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('search=api'),
        expect.any(Object)
      );
    });

    it('should update access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'token-1', name: 'Updated' })),
      });

      const result = await client.updateAccessToken('token-1', { name: 'Updated' });

      expect(result.success).toBe(true);
    });

    it('should delete access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(''),
      });

      const result = await client.deleteAccessToken('token-1');

      expect(result.success).toBe(true);
    });

    it('should get single access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'token-1', name: 'Token' })),
      });

      const result = await client.getAccessToken('token-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/access-tokens/token-1',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Question Sets CRUD', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ user: {}, csrfToken: 'csrf' })),
      });
      await client.login({ email: 'test@test.com', password: 'pass' });
    });

    it('should create question set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'qs-1', name: 'Questions' })),
      });

      const result = await client.createQuestionSet({
        name: 'Questions',
        questions: [{ question: 'Q1' }],
      });

      expect(result.success).toBe(true);
    });

    it('should import question set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'qs-1', name: 'Imported' })),
      });

      const result = await client.importQuestionSet({
        name: 'Imported',
        questions: [{ question: 'Q1' }],
      });

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/questions/import',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });

    it('should get single question set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'qs-1', name: 'Questions' })),
      });

      const result = await client.getQuestionSet('qs-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/questions/qs-1',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should get question sets with filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ data: [], total: 0, page: 1, limit: 10 })),
      });

      await client.getQuestionSets({ search: 'test', page: 1, limit: 10 });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('search=test'),
        expect.any(Object)
      );
    });

    it('should update question set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'qs-1', name: 'Updated' })),
      });

      const result = await client.updateQuestionSet('qs-1', { name: 'Updated' });

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/questions/qs-1',
        expect.objectContaining({ method: 'PUT' })
      );
      expect(result.success).toBe(true);
    });

    it('should delete question set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(''),
      });

      const result = await client.deleteQuestionSet('qs-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/questions/qs-1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Webhooks CRUD', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ user: {}, csrfToken: 'csrf' })),
      });
      await client.login({ email: 'test@test.com', password: 'pass' });
    });

    it('should create webhook', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'wh-1', name: 'Webhook' })),
      });

      const result = await client.createWebhook({
        name: 'Webhook',
        url: 'http://callback.url',
        events: ['run.completed'],
        method: 'POST',
        bodyTemplate: { message: '{{run.id}}' },
      });

      expect(result.success).toBe(true);
    });

    it('should get webhooks with filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ data: [], total: 0, page: 1, limit: 10 })),
      });

      await client.getWebhooks({ enabled: true, event: 'run.completed' });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('enabled=true'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('event=run.completed'),
        expect.any(Object)
      );
    });

    it('should toggle webhook', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'wh-1', enabled: true })),
      });

      const result = await client.toggleWebhook('wh-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/webhooks/wh-1/toggle',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });

    it('should test webhook', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ success: true, message: 'OK' })),
      });

      const result = await client.testWebhook('wh-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/webhooks/wh-1/test',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });

    it('should get webhook events', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({ events: ['run.started', 'run.completed'] })
          ),
      });

      const result = await client.getWebhookEvents();

      expect(result.success).toBe(true);
    });

    it('should get webhook variables', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ variables: [{ name: 'run.id' }] })),
      });

      const result = await client.getWebhookVariables();

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/webhooks/variables',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should get single webhook', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'wh-1', name: 'Webhook' })),
      });

      const result = await client.getWebhook('wh-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/webhooks/wh-1',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should update webhook', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'wh-1', name: 'Updated' })),
      });

      const result = await client.updateWebhook('wh-1', { name: 'Updated' });

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/webhooks/wh-1',
        expect.objectContaining({ method: 'PUT' })
      );
      expect(result.success).toBe(true);
    });

    it('should delete webhook', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(''),
      });

      const result = await client.deleteWebhook('wh-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/webhooks/wh-1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Tags CRUD', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ user: {}, csrfToken: 'csrf' })),
      });
      await client.login({ email: 'test@test.com', password: 'pass' });
    });

    it('should create tag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'tag-1', name: 'Important' })),
      });

      const result = await client.createTag({ name: 'Important', color: '#ff0000' });

      expect(result.success).toBe(true);
    });

    it('should get tag usage', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ tests: [{ id: 't1', name: 'Test' }] })),
      });

      const result = await client.getTagUsage('tag-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/tags/tag-1/usage',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should get tags with filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ data: [], total: 0, page: 1, limit: 10 })),
      });

      await client.getTags({ search: 'important', page: 1, limit: 10 });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('search=important'),
        expect.any(Object)
      );
    });

    it('should get single tag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'tag-1', name: 'Important' })),
      });

      const result = await client.getTag('tag-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/tags/tag-1',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should update tag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'tag-1', name: 'Updated' })),
      });

      const result = await client.updateTag('tag-1', { name: 'Updated' });

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/tags/tag-1',
        expect.objectContaining({ method: 'PUT' })
      );
      expect(result.success).toBe(true);
    });

    it('should delete tag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(''),
      });

      const result = await client.deleteTag('tag-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/tags/tag-1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Scheduled Tests CRUD', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ user: {}, csrfToken: 'csrf' })),
      });
      await client.login({ email: 'test@test.com', password: 'pass' });
    });

    it('should create scheduled test', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'st-1', testId: 'test-1' })),
      });

      const result = await client.createScheduledTest({
        name: 'Nightly Test',
        testId: 'test-1',
        scheduleType: 'cron',
        cronExpression: '0 0 * * *',
      });

      expect(result.success).toBe(true);
    });

    it('should get scheduled tests with filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ data: [], total: 0, page: 1, limit: 10 })),
      });

      await client.getScheduledTests({ testId: 'test-1', status: 'pending' });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('testId=test-1'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('status=pending'),
        expect.any(Object)
      );
    });

    it('should reset scheduled test', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'st-1', status: 'active' })),
      });

      const result = await client.resetScheduledTest('st-1', '2024-01-01T00:00:00Z');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/scheduled-tests/st-1/reset',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ scheduledAt: '2024-01-01T00:00:00Z' }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('should execute scheduled test now', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Execution started' })),
      });

      const result = await client.executeScheduledTestNow('st-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/scheduled-tests/st-1/execute',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });

    it('should get single scheduled test', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'st-1', name: 'Nightly' })),
      });

      const result = await client.getScheduledTest('st-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/scheduled-tests/st-1',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should update scheduled test', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'st-1', name: 'Updated' })),
      });

      const result = await client.updateScheduledTest('st-1', { name: 'Updated' });

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/scheduled-tests/st-1',
        expect.objectContaining({ method: 'PUT' })
      );
      expect(result.success).toBe(true);
    });

    it('should delete scheduled test', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(''),
      });

      const result = await client.deleteScheduledTest('st-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/scheduled-tests/st-1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Account Management', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ user: {}, csrfToken: 'csrf' })),
      });
      await client.login({ email: 'test@test.com', password: 'pass' });
    });

    it('should get account stats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ testsCount: 5, runsCount: 10 })),
      });

      const result = await client.getAccountStats();

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/auth/account/stats',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should change password and trigger logout', async () => {
      const authChangeSpy = jest.fn();
      client.setOnAuthChange(authChangeSpy);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Password changed' })),
      });

      const result = await client.changePassword({
        currentPassword: 'old',
        newPassword: 'new',
        confirmPassword: 'new',
      });

      expect(result.success).toBe(true);
      expect(authChangeSpy).toHaveBeenCalledWith(false);
    });

    it('should delete account and trigger logout', async () => {
      const authChangeSpy = jest.fn();
      client.setOnAuthChange(authChangeSpy);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Account deleted' })),
      });

      const result = await client.deleteAccount();

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/auth/account',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result.success).toBe(true);
      expect(authChangeSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('LLM Evaluation', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ user: {}, csrfToken: 'csrf' })),
      });
      await client.login({ email: 'test@test.com', password: 'pass' });
    });

    it('should evaluate with LLM', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({ evaluation: 'correct', confidence: 0.9, reasoning: 'Good' })
          ),
      });

      const result = await client.evaluateWithLLM('What is 2+2?', '4', '4');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/evaluate/llm-judge',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            question: 'What is 2+2?',
            answer: '4',
            expectedAnswer: '4',
          }),
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Flow Configs CRUD', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ user: {}, csrfToken: 'csrf' })),
      });
      await client.login({ email: 'test@test.com', password: 'pass' });
    });

    it('should create flow config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'fc-1', name: 'Config' })),
      });

      const result = await client.createFlowConfig({
        name: 'Config',
        flowId: 'flow-1',
        basePath: 'http://api',
      });

      expect(result.success).toBe(true);
    });

    it('should get flow configs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ data: [], total: 0, page: 1, limit: 10 })),
      });

      await client.getFlowConfigs({ search: 'test' });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('search=test'),
        expect.any(Object)
      );
    });

    it('should get single flow config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'fc-1', name: 'Config' })),
      });

      const result = await client.getFlowConfig('fc-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/flow-configs/fc-1',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should update flow config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ id: 'fc-1', name: 'Updated' })),
      });

      const result = await client.updateFlowConfig('fc-1', { name: 'Updated' });

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/flow-configs/fc-1',
        expect.objectContaining({ method: 'PUT' })
      );
      expect(result.success).toBe(true);
    });

    it('should delete flow config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(''),
      });

      const result = await client.deleteFlowConfig('fc-1');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/flow-configs/fc-1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Export/Import', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ user: {}, csrfToken: 'csrf' })),
      });
      await client.login({ email: 'test@test.com', password: 'pass' });
    });

    it('should export config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({ version: '1.0', tests: [], questionSets: [] })
          ),
      });

      const result = await client.exportConfig({
        types: ['tests', 'questionSets'],
        testIds: ['t1', 't2'],
      });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('types=tests'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('types=questionSets'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('testIds=t1'),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should export config with all optional params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({ version: '1.0', tests: [], questionSets: [] })
          ),
      });

      await client.exportConfig({
        types: ['tests'],
        questionSetIds: ['qs1'],
        flowConfigIds: ['fc1'],
        tagIds: ['tag1'],
        webhookIds: ['wh1'],
        runIds: ['run1'],
      });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('questionSetIds=qs1'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('flowConfigIds=fc1'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('tagIds=tag1'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('webhookIds=wh1'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('runIds=run1'),
        expect.any(Object)
      );
    });

    it('should preview import', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({ conflicts: [], toCreate: [], toUpdate: [] })
          ),
      });

      const bundle = { version: '1.0', tests: [], questionSets: [] } as any;
      const result = await client.previewImport(bundle);

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/export/preview',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });

    it('should import config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(JSON.stringify({ created: [], updated: [], skipped: [] })),
      });

      const bundle = { version: '1.0', tests: [], questionSets: [] } as any;
      const result = await client.importConfig(bundle, 'skip');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/export/import',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            bundle,
            options: { conflictStrategy: 'skip' },
          }),
        })
      );
      expect(result.success).toBe(true);
    });
  });
});
