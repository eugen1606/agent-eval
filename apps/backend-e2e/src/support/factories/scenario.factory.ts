import { authenticatedRequest } from '../test-setup';
import { createPersona } from './persona.factory';

const defaults = {
  name: 'Test Scenario',
  goal: 'Get help with a technical issue and verify the agent provides a working solution.',
  maxTurns: 10,
};

export async function createScenario(
  accessToken: string,
  testId: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  if (!overrides.personaId) {
    const persona = await createPersona(accessToken, {
      name: `Scenario Persona ${Date.now()}`,
    });
    overrides = { personaId: persona.id, ...overrides };
  }

  const response = await authenticatedRequest(
    `/tests/${testId}/scenarios`,
    {
      method: 'POST',
      body: JSON.stringify({ ...defaults, ...overrides }),
    },
    accessToken,
  );

  expect(response.status).toBe(201);
  return response.json();
}
