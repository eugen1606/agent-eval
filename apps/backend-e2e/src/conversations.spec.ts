import {
  authenticatedRequest,
  createTestUser,
  deleteTestUser,
} from './support/test-setup';
import { createTest, createPersona, createScenario, createRun } from './support/factories';
import { NON_EXISTENT_UUID, expectNotFound } from './support/assertions';

describe('Conversations CRUD & Evaluation', () => {
  let accessToken: string;
  let csrfToken: string;
  let testId: string;
  let runId: string;

  // Helper to create a conversation test with scenarios and a run
  async function setupConversationTestWithRun(): Promise<{
    testId: string;
    runId: string;
    scenarioIds: string[];
  }> {
    const test = await createTest(accessToken, {
      name: `Conv Run Test ${Date.now()}`,
      type: 'conversation',
      executionMode: 'sequential',
      simulatedUserModel: 'gpt-4o-mini',
    });

    const persona = await createPersona(accessToken, {
      name: `Conv Run Persona ${Date.now()}`,
    });

    const s1 = await createScenario(accessToken, test.id as string, {
      personaId: persona.id,
      name: `Scenario 1 ${Date.now()}`,
      goal: 'Ask about return policy.',
      maxTurns: 5,
    });

    const s2 = await createScenario(accessToken, test.id as string, {
      personaId: persona.id,
      name: `Scenario 2 ${Date.now()}`,
      goal: 'Ask about shipping times.',
      maxTurns: 5,
    });

    const run = await createRun(accessToken, {
      testId: test.id,
      totalQuestions: 0,
    });

    return {
      testId: test.id as string,
      runId: run.id as string,
      scenarioIds: [s1.id as string, s2.id as string],
    };
  }

  beforeAll(async () => {
    const auth = await createTestUser('-conversations');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;

    // Setup a basic test and run for conversation tests
    const setup = await setupConversationTestWithRun();
    testId = setup.testId;
    runId = setup.runId;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  describe('GET /api/runs/:runId/conversations', () => {
    it('should return empty list for run with no conversations', async () => {
      const response = await authenticatedRequest(
        `/runs/${runId}/conversations`,
        {},
        accessToken,
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return 404 for non-existent run', async () => {
      const response = await authenticatedRequest(
        `/runs/${NON_EXISTENT_UUID}/conversations`,
        {},
        accessToken,
      );
      expectNotFound(response);
    });
  });

  describe('GET /api/runs/:runId/conversations/stats', () => {
    it('should return stats for a run', async () => {
      const response = await authenticatedRequest(
        `/runs/${runId}/conversations/stats`,
        {},
        accessToken,
      );

      expect(response.status).toBe(200);
      const stats = await response.json();

      expect(stats).toHaveProperty('totalScenarios');
      expect(stats).toHaveProperty('completedScenarios');
      expect(stats).toHaveProperty('goalAchievedCount');
      expect(stats).toHaveProperty('goalNotAchievedCount');
      expect(stats).toHaveProperty('maxTurnsReachedCount');
      expect(stats).toHaveProperty('errorCount');
      expect(stats).toHaveProperty('averageTurns');
      expect(stats).toHaveProperty('evaluations');
      expect(stats.evaluations).toHaveProperty('good');
      expect(stats.evaluations).toHaveProperty('acceptable');
      expect(stats.evaluations).toHaveProperty('poor');
      expect(stats.evaluations).toHaveProperty('unevaluated');
    });

    it('should return 404 for non-existent run', async () => {
      const response = await authenticatedRequest(
        `/runs/${NON_EXISTENT_UUID}/conversations/stats`,
        {},
        accessToken,
      );
      expectNotFound(response);
    });
  });

  describe('GET /api/runs/:runId/conversations/:conversationId', () => {
    it('should return 404 for non-existent conversation', async () => {
      const response = await authenticatedRequest(
        `/runs/${runId}/conversations/${NON_EXISTENT_UUID}`,
        {},
        accessToken,
      );
      expectNotFound(response);
    });
  });

  describe('PUT /api/runs/:runId/conversations/:cid/evaluate', () => {
    it('should return 404 for non-existent conversation', async () => {
      const response = await authenticatedRequest(
        `/runs/${runId}/conversations/${NON_EXISTENT_UUID}/evaluate`,
        {
          method: 'PUT',
          body: JSON.stringify({
            humanEvaluation: 'good',
          }),
        },
        accessToken,
      );
      expectNotFound(response);
    });
  });

  describe('POST /api/runs/:runId/conversations/:cid/rerun', () => {
    it('should return 404 for non-existent conversation', async () => {
      const response = await authenticatedRequest(
        `/runs/${runId}/conversations/${NON_EXISTENT_UUID}/rerun`,
        {
          method: 'POST',
        },
        accessToken,
      );
      expectNotFound(response);
    });
  });

  describe('Data isolation', () => {
    it('should not allow another user to access conversations', async () => {
      const auth2 = await createTestUser('-conv-isolation2');

      // Other user cannot list conversations for our run
      const response = await authenticatedRequest(
        `/runs/${runId}/conversations`,
        {},
        auth2.accessToken,
      );
      expectNotFound(response);

      // Other user cannot get conversation stats
      const statsRes = await authenticatedRequest(
        `/runs/${runId}/conversations/stats`,
        {},
        auth2.accessToken,
      );
      expectNotFound(statsRes);

      await deleteTestUser(auth2.accessToken, auth2.csrfToken);
    });
  });
});
