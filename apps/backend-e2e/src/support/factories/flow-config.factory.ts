import { authenticatedRequest } from '../test-setup';

const defaults = {
  name: 'Test Flow Config',
  flowId: 'test-flow-123',
  basePath: 'https://api.example.com',
};

export async function createFlowConfig(
  accessToken: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await authenticatedRequest(
    '/flow-configs',
    {
      method: 'POST',
      body: JSON.stringify({ ...defaults, ...overrides }),
    },
    accessToken,
  );

  expect(response.status).toBe(201);
  return response.json();
}
