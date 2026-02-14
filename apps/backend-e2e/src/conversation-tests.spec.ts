import {
  authenticatedRequest,
  createTestUser,
  deleteTestUser,
} from './support/test-setup';
import { createTest, createPersona, createScenario, createRun } from './support/factories';
import { NON_EXISTENT_UUID, expectNotFound } from './support/assertions';

describe('Conversation Tests Integration', () => {
  let accessToken: string;
  let csrfToken: string;

  beforeAll(async () => {
    const auth = await createTestUser('-conv-tests');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  describe('Creating conversation-type tests', () => {
    it('should create a conversation test with scenarios', async () => {
      const test = await createTest(accessToken, {
        name: `Conv Test ${Date.now()}`,
        type: 'conversation',
        executionMode: 'sequential',
        simulatedUserModel: 'gpt-4o-mini',
      });

      expect(test.type).toBe('conversation');
      expect(test.executionMode).toBe('sequential');
      expect(test.simulatedUserModel).toBe('gpt-4o-mini');

      // Add scenarios
      const persona = await createPersona(accessToken, {
        name: `Test Persona ${Date.now()}`,
      });

      const scenario = await createScenario(accessToken, test.id as string, {
        personaId: persona.id,
        name: 'Test Scenario',
        goal: 'Get help with a billing issue.',
        maxTurns: 5,
      });

      expect(scenario.testId).toBe(test.id);
      expect(scenario.goal).toBe('Get help with a billing issue.');
    });

    it('should not allow adding scenarios to a QA test', async () => {
      const qaTest = await createTest(accessToken, {
        name: `QA Only ${Date.now()}`,
      });

      const persona = await createPersona(accessToken, {
        name: `QA Persona ${Date.now()}`,
      });

      const response = await authenticatedRequest(
        `/tests/${qaTest.id}/scenarios`,
        {
          method: 'POST',
          body: JSON.stringify({
            personaId: persona.id,
            name: 'Should Fail',
            goal: 'This should not work.',
          }),
        },
        accessToken,
      );

      expect(response.status).toBe(400);
    });

    it('should filter tests by type', async () => {
      await createTest(accessToken, {
        name: `FilterConv ${Date.now()}`,
        type: 'conversation',
        executionMode: 'sequential',
      });

      const response = await authenticatedRequest(
        '/tests?type=conversation',
        {},
        accessToken,
      );
      expect(response.status).toBe(200);
      const result = await response.json();

      expect(result.data.length).toBeGreaterThanOrEqual(1);
      result.data.forEach((test: Record<string, unknown>) => {
        expect(test.type).toBe('conversation');
      });
    });

    it('should include scenarios in conversation test response', async () => {
      const test = await createTest(accessToken, {
        name: `Includes Scenarios ${Date.now()}`,
        type: 'conversation',
        executionMode: 'sequential',
      });

      const persona = await createPersona(accessToken, {
        name: `IncScenarios Persona ${Date.now()}`,
      });

      await createScenario(accessToken, test.id as string, {
        personaId: persona.id,
        name: `Included Scenario ${Date.now()}`,
        goal: 'Will be included in test response.',
      });

      const response = await authenticatedRequest(
        `/tests/${test.id}`,
        {},
        accessToken,
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.type).toBe('conversation');
      expect(data.scenarios).toBeDefined();
      expect(Array.isArray(data.scenarios)).toBe(true);
      expect(data.scenarios.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Conversation test configuration validation', () => {
    it('should accept valid execution modes', async () => {
      const seqTest = await createTest(accessToken, {
        name: `Sequential ${Date.now()}`,
        type: 'conversation',
        executionMode: 'sequential',
      });
      expect(seqTest.executionMode).toBe('sequential');

      const parTest = await createTest(accessToken, {
        name: `Parallel ${Date.now()}`,
        type: 'conversation',
        executionMode: 'parallel',
      });
      expect(parTest.executionMode).toBe('parallel');
    });

    it('should accept simulated user model configuration', async () => {
      const test = await createTest(accessToken, {
        name: `Model Config ${Date.now()}`,
        type: 'conversation',
        executionMode: 'sequential',
        simulatedUserModel: 'gpt-4o',
        simulatedUserModelConfig: { temperature: 0.5, maxTokens: 2000 },
        delayBetweenTurns: 1000,
      });

      expect(test.simulatedUserModel).toBe('gpt-4o');
      expect(test.simulatedUserModelConfig).toEqual({
        temperature: 0.5,
        maxTokens: 2000,
      });
      expect(test.delayBetweenTurns).toBe(1000);
    });
  });

  describe('Conversation run creation', () => {
    it('should create a run for a conversation test', async () => {
      const test = await createTest(accessToken, {
        name: `Run Conv Test ${Date.now()}`,
        type: 'conversation',
        executionMode: 'sequential',
      });

      const run = await createRun(accessToken, {
        testId: test.id,
        totalQuestions: 0,
      });

      expect(run.testId).toBe(test.id);
      expect(run.status).toBe('pending');
    });
  });

  describe('Data isolation for conversation tests', () => {
    it('should not allow another user to access conversation test', async () => {
      const auth2 = await createTestUser('-conv-isolation');

      const test = await createTest(accessToken, {
        name: `Isolated Conv Test ${Date.now()}`,
        type: 'conversation',
        executionMode: 'sequential',
      });

      // Other user cannot access
      const response = await authenticatedRequest(
        `/tests/${test.id}`,
        {},
        auth2.accessToken,
      );
      expectNotFound(response);

      // Other user cannot list scenarios
      const scenResponse = await authenticatedRequest(
        `/tests/${test.id}/scenarios`,
        {},
        auth2.accessToken,
      );
      expectNotFound(scenResponse);

      await deleteTestUser(auth2.accessToken, auth2.csrfToken);
    });
  });
});
