import { authenticatedRequest } from '../test-setup';

let evalCounter = 0;

const defaults = {
  name: 'Test Evaluator',
  description: 'A test evaluator',
  model: 'gpt-4o',
  systemPrompt: 'You are a test evaluator. Respond with JSON: {"score": 80, "isCorrect": true, "reasoning": "test"}',
};

export async function createEvaluator(
  accessToken: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await authenticatedRequest(
    '/evaluators',
    {
      method: 'POST',
      body: JSON.stringify({
        ...defaults,
        name: `Test Evaluator ${Date.now()}-${evalCounter++}`,
        ...overrides,
      }),
    },
    accessToken,
  );

  expect(response.status).toBe(201);
  return response.json();
}
