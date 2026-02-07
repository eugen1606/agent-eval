import { authenticatedRequest } from '../test-setup';
import { createTest } from './test.factory';

const defaults = {
  status: 'pending',
  totalQuestions: 5,
};

export async function createRun(
  accessToken: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  if (!overrides.testId) {
    const test = await createTest(accessToken);
    overrides = { testId: test.id, ...overrides };
  }

  const response = await authenticatedRequest(
    '/runs',
    {
      method: 'POST',
      body: JSON.stringify({ ...defaults, ...overrides }),
    },
    accessToken,
  );

  expect(response.status).toBe(201);
  return response.json();
}
