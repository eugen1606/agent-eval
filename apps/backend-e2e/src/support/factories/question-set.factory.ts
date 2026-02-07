import { authenticatedRequest } from '../test-setup';

const defaults = {
  name: 'Test Question Set',
  questions: [
    { question: 'What is 2+2?', expectedAnswer: '4' },
    { question: 'What is the capital of France?', expectedAnswer: 'Paris' },
  ],
};

export async function createQuestionSet(
  accessToken: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await authenticatedRequest(
    '/questions',
    {
      method: 'POST',
      body: JSON.stringify({ ...defaults, ...overrides }),
    },
    accessToken,
  );

  expect(response.status).toBe(201);
  return response.json();
}
