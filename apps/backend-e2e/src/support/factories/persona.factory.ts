import { authenticatedRequest } from '../test-setup';

const defaults = {
  name: 'Test Persona',
  description: 'A test persona for E2E testing',
  systemPrompt: 'You are a helpful test user.',
};

export async function createPersona(
  accessToken: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await authenticatedRequest(
    '/personas',
    {
      method: 'POST',
      body: JSON.stringify({ ...defaults, ...overrides }),
    },
    accessToken,
  );

  expect(response.status).toBe(201);
  return response.json();
}
