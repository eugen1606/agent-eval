import { authenticatedRequest } from '../test-setup';

let tokenCounter = 0;

const defaults = {
  name: 'Test API Token',
  description: 'A test API token',
};

export async function createAccessToken(
  accessToken: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await authenticatedRequest(
    '/access-tokens',
    {
      method: 'POST',
      body: JSON.stringify({
        ...defaults,
        token: `test-token-${Date.now()}-${tokenCounter++}`,
        ...overrides,
      }),
    },
    accessToken,
  );

  expect(response.status).toBe(201);
  return response.json();
}
