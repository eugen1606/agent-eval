import { authenticatedRequest } from '../test-setup';

const defaults = {
  name: 'Test Webhook',
  url: 'https://example.com/webhook',
  events: ['run.completed'],
  method: 'POST',
  bodyTemplate: {
    event: '{{event}}',
    runId: '{{runId}}',
  },
};

export async function createWebhook(
  accessToken: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await authenticatedRequest(
    '/webhooks',
    {
      method: 'POST',
      body: JSON.stringify({ ...defaults, ...overrides }),
    },
    accessToken,
  );

  expect(response.status).toBe(201);
  return response.json();
}
