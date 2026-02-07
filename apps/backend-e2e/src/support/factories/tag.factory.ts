import { authenticatedRequest } from '../test-setup';

const defaults = {
  name: 'Test Tag',
  color: '#3B82F6',
};

export async function createTag(
  accessToken: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await authenticatedRequest(
    '/tags',
    {
      method: 'POST',
      body: JSON.stringify({ ...defaults, ...overrides }),
    },
    accessToken,
  );

  expect(response.status).toBe(201);
  return response.json();
}
