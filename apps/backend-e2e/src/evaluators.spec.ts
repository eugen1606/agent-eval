import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';
import { createAccessToken, createEvaluator } from './support/factories';
import { expectPaginatedList, expectDeleteAndVerify, NON_EXISTENT_UUID } from './support/assertions';

describe('Evaluators CRUD', () => {
  let accessToken: string;
  let csrfToken: string;
  let credentialId: string;

  beforeAll(async () => {
    const auth = await createTestUser('-evaluators');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;

    // Create an OpenAI credential for evaluator tests
    const cred = await createAccessToken(accessToken, {
      name: 'Test OpenAI Key',
      token: 'sk-test-key-123',
      type: 'openai',
    });
    credentialId = cred.id as string;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  describe('POST /api/evaluators', () => {
    it('should create an evaluator', async () => {
      const data = await createEvaluator(accessToken, {
        name: 'My GPT-4o Evaluator',
        description: 'Evaluates with GPT-4o',
        accessTokenId: credentialId,
        model: 'gpt-4o',
        systemPrompt: 'Evaluate answers as JSON.',
      });

      expect(data.name).toBe('My GPT-4o Evaluator');
      expect(data.description).toBe('Evaluates with GPT-4o');
      expect(data.model).toBe('gpt-4o');
      expect(data.accessTokenId).toBe(credentialId);
      expect(data.systemPrompt).toBeDefined();
    });

    it('should fail with missing required fields', async () => {
      const response = await authenticatedRequest('/evaluators', {
        method: 'POST',
        body: JSON.stringify({ name: 'Missing fields' }),
      }, accessToken);

      expect(response.status).toBe(400);
    });

    it('should fail with invalid accessTokenId', async () => {
      const response = await authenticatedRequest('/evaluators', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Bad Token',
          accessTokenId: NON_EXISTENT_UUID,
          model: 'gpt-4o',
          systemPrompt: 'test',
        }),
      }, accessToken);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/evaluators', () => {
    it('should list evaluators', async () => {
      await createEvaluator(accessToken, {
        accessTokenId: credentialId,
      });

      const response = await authenticatedRequest('/evaluators', {}, accessToken);
      await expectPaginatedList(response, { minLength: 1 });
    });

    it('should support search', async () => {
      const uniqueName = `SearchEval-${Date.now()}`;
      await createEvaluator(accessToken, {
        name: uniqueName,
        accessTokenId: credentialId,
      });

      const response = await authenticatedRequest(
        `/evaluators?search=${encodeURIComponent(uniqueName)}`,
        {},
        accessToken,
      );
      const result = await expectPaginatedList(response, { minLength: 1 });
      expect(result.data[0].name).toBe(uniqueName);
    });
  });

  describe('GET /api/evaluators/:id', () => {
    it('should get a single evaluator', async () => {
      const created = await createEvaluator(accessToken, {
        accessTokenId: credentialId,
      });

      const response = await authenticatedRequest(
        `/evaluators/${created.id}`,
        {},
        accessToken,
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe(created.id);
    });

    it('should return 404 for non-existent evaluator', async () => {
      const response = await authenticatedRequest(
        `/evaluators/${NON_EXISTENT_UUID}`,
        {},
        accessToken,
      );
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/evaluators/:id', () => {
    it('should update an evaluator', async () => {
      const created = await createEvaluator(accessToken, {
        accessTokenId: credentialId,
      });

      const response = await authenticatedRequest(
        `/evaluators/${created.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated Evaluator', model: 'gpt-4o-mini' }),
        },
        accessToken,
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.name).toBe('Updated Evaluator');
      expect(data.model).toBe('gpt-4o-mini');
    });
  });

  describe('DELETE /api/evaluators/:id', () => {
    it('should delete an evaluator', async () => {
      const created = await createEvaluator(accessToken, {
        accessTokenId: credentialId,
      });

      await expectDeleteAndVerify('/evaluators', created.id as string, accessToken);
    });
  });

  describe('User isolation', () => {
    it('should not allow accessing another user\'s evaluator', async () => {
      const created = await createEvaluator(accessToken, {
        accessTokenId: credentialId,
      });

      // Create second user
      const auth2 = await createTestUser('-evaluators-isolation');

      const response = await authenticatedRequest(
        `/evaluators/${created.id}`,
        {},
        auth2.accessToken,
      );
      expect(response.status).toBe(404);

      await deleteTestUser(auth2.accessToken, auth2.csrfToken);
    });
  });
});
