// Test setup for e2e tests

export const API_URL = process.env.API_URL || 'http://localhost:3001/api';

// Track created test users for cleanup
const createdTestUsers: Array<{ accessToken: string; csrfToken: string; email: string }> = [];

// Clear throttle keys before tests
export async function clearThrottleKeys(): Promise<void> {
  try {
    await fetch(`${API_URL}/health/clear-throttle`, { method: 'POST' });
  } catch {
    // Ignore errors - endpoint may not be available
  }
}

// Helper function to make authenticated requests
export async function authenticatedRequest(
  endpoint: string,
  options: RequestInit = {},
  accessToken: string,
  csrfToken?: string,
): Promise<Response> {
  return fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      ...options.headers,
    },
  });
}

// Helper to create a test user and get tokens
export async function createTestUser(suffix = ''): Promise<{
  user: { id: string; email: string };
  accessToken: string;
  csrfToken: string;
}> {
  const email = `test-${Date.now()}${suffix}@e2e-test.local`;
  const password = 'Testpassword123!';

  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName: 'E2E Test User' }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create test user: ${await response.text()}`);
  }

  const data = await response.json();

  // Track for cleanup
  createdTestUsers.push({ accessToken: data.tokens.accessToken, csrfToken: data.csrfToken, email });

  return {
    user: data.user,
    accessToken: data.tokens.accessToken,
    csrfToken: data.csrfToken,
  };
}

// Helper to delete a test user (cascade deletes all their data)
export async function deleteTestUser(accessToken: string, csrfToken?: string): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      },
    });
  } catch {
    // Ignore errors - user may already be deleted
  }
}

// Cleanup all tracked test users
export async function cleanupAllTestUsers(): Promise<void> {
  const promises = createdTestUsers.map(({ accessToken, csrfToken }) =>
    deleteTestUser(accessToken, csrfToken),
  );
  await Promise.all(promises);
  createdTestUsers.length = 0; // Clear the array
}

// Helper to login
export async function loginUser(
  email: string,
  password: string,
): Promise<{
  user: { id: string; email: string };
  accessToken: string;
  refreshToken: string;
}> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Failed to login: ${await response.text()}`);
  }

  const data = await response.json();
  return {
    user: data.user,
    accessToken: data.tokens.accessToken,
    refreshToken: data.tokens.refreshToken,
  };
}
