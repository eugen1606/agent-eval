import { authenticatedRequest } from '../test-setup';
import { createFlowConfig } from './flow-config.factory';

const defaults = {
  name: 'Test Configuration',
};

export async function createTest(
  accessToken: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  if (!overrides.flowConfigId) {
    const flowConfig = await createFlowConfig(accessToken);
    overrides = { flowConfigId: flowConfig.id, ...overrides };
  }

  const response = await authenticatedRequest(
    '/tests',
    {
      method: 'POST',
      body: JSON.stringify({ ...defaults, ...overrides }),
    },
    accessToken,
  );

  expect(response.status).toBe(201);
  return response.json();
}
