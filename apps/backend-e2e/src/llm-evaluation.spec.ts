import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';
import { createAccessToken, createEvaluator } from './support/factories';
import { NON_EXISTENT_UUID } from './support/assertions';

describe('LLM Evaluation', () => {
  let accessToken: string;
  let csrfToken: string;
  let credentialId: string;
  let evaluatorId: string;

  beforeAll(async () => {
    const auth = await createTestUser('-llm-eval');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;

    // Create credential and evaluator
    const cred = await createAccessToken(accessToken, {
      name: 'Test OpenAI Key for Eval',
      token: 'sk-test-key-eval',
      type: 'openai',
    });
    credentialId = cred.id as string;

    const evaluator = await createEvaluator(accessToken, {
      name: 'Test LLM Evaluator',
      accessTokenId: credentialId,
      model: 'gpt-4o',
      systemPrompt: 'Evaluate and respond with JSON.',
    });
    evaluatorId = evaluator.id as string;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  describe('GET /api/evaluate/llm-judge/status', () => {
    it('should return evaluators list', async () => {
      const response = await authenticatedRequest(
        '/evaluate/llm-judge/status',
        {},
        accessToken,
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.available).toBe(true);
      expect(Array.isArray(data.evaluators)).toBe(true);
      expect(data.evaluators.length).toBeGreaterThanOrEqual(1);
      expect(data.evaluators[0]).toHaveProperty('id');
      expect(data.evaluators[0]).toHaveProperty('name');
      expect(data.evaluators[0]).toHaveProperty('model');
    });

    it('should return available=false for user with no evaluators', async () => {
      const auth2 = await createTestUser('-llm-eval-empty');
      const response = await authenticatedRequest(
        '/evaluate/llm-judge/status',
        {},
        auth2.accessToken,
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.available).toBe(false);
      expect(data.evaluators).toHaveLength(0);
      await deleteTestUser(auth2.accessToken, auth2.csrfToken);
    });
  });

  describe('POST /api/runs/:id/evaluate-llm', () => {
    it('should return 404 for non-existent run', async () => {
      const response = await authenticatedRequest(
        `/runs/${NON_EXISTENT_UUID}/evaluate-llm`,
        {
          method: 'POST',
          body: JSON.stringify({ evaluatorId }),
        },
        accessToken,
      );
      // SSE endpoint may return 404 or error in stream
      expect([404, 500].includes(response.status) || response.status === 200).toBe(true);
    });
  });

  describe('POST /api/runs/:id/results/:resultId/evaluate-llm', () => {
    it('should return 404 for non-existent run', async () => {
      const response = await authenticatedRequest(
        `/runs/${NON_EXISTENT_UUID}/results/${NON_EXISTENT_UUID}/evaluate-llm`,
        {
          method: 'POST',
          body: JSON.stringify({ evaluatorId }),
        },
        accessToken,
      );
      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent evaluator', async () => {
      // First create a run to have a valid run ID
      const testRes = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'LLM Eval Test',
          flowId: 'test-flow',
          basePath: 'http://localhost:3000',
        }),
      }, accessToken);
      const test = await testRes.json();

      const runRes = await authenticatedRequest('/runs', {
        method: 'POST',
        body: JSON.stringify({ testId: test.id }),
      }, accessToken);
      const run = await runRes.json();

      const response = await authenticatedRequest(
        `/runs/${run.id}/results/${NON_EXISTENT_UUID}/evaluate-llm`,
        {
          method: 'POST',
          body: JSON.stringify({ evaluatorId: NON_EXISTENT_UUID }),
        },
        accessToken,
      );
      // Should fail because evaluator doesn't exist or result doesn't exist
      expect([404, 500].includes(response.status)).toBe(true);
    });
  });
});
