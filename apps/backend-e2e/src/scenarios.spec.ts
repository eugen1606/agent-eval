import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';
import { createTest, createPersona, createScenario } from './support/factories';
import { NON_EXISTENT_UUID, expectNotFound } from './support/assertions';

describe('Scenarios CRUD', () => {
  let accessToken: string;
  let csrfToken: string;
  let conversationTestId: string;
  let qaTestId: string;
  let personaId: string;

  beforeAll(async () => {
    const auth = await createTestUser('-scenarios');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;

    // Create a conversation-type test
    const convTest = await createTest(accessToken, {
      name: 'Conversation Test for Scenarios',
      type: 'conversation',
      executionMode: 'sequential',
    });
    conversationTestId = convTest.id as string;

    // Create a QA-type test
    const qaTest = await createTest(accessToken, {
      name: 'QA Test for Scenarios',
    });
    qaTestId = qaTest.id as string;

    // Create a persona for scenarios
    const persona = await createPersona(accessToken, {
      name: `Scenario Persona ${Date.now()}`,
    });
    personaId = persona.id as string;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  describe('POST /api/tests/:id/scenarios', () => {
    it('should create a scenario on a conversation test', async () => {
      const data = await createScenario(accessToken, conversationTestId, {
        personaId,
        name: 'TV not working',
        goal: 'Get help fixing a broken TV.',
        maxTurns: 15,
      });

      expect(data.name).toBe('TV not working');
      expect(data.goal).toBe('Get help fixing a broken TV.');
      expect(data.maxTurns).toBe(15);
      expect(data.personaId).toBe(personaId);
      expect(data.persona).toBeDefined();
      expect(data.testId).toBe(conversationTestId);
    });

    it('should use default maxTurns when not specified', async () => {
      const data = await createScenario(accessToken, conversationTestId, {
        personaId,
        name: `Default Turns ${Date.now()}`,
        goal: 'Test default max turns.',
      });

      expect(data.maxTurns).toBe(30);
    });

    it('should not allow adding scenarios to a QA test', async () => {
      const response = await authenticatedRequest(
        `/tests/${qaTestId}/scenarios`,
        {
          method: 'POST',
          body: JSON.stringify({
            personaId,
            name: 'Should Fail',
            goal: 'This should not work.',
          }),
        },
        accessToken,
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toMatch(/conversation/i);
    });

    it('should reject missing name', async () => {
      const response = await authenticatedRequest(
        `/tests/${conversationTestId}/scenarios`,
        {
          method: 'POST',
          body: JSON.stringify({
            personaId,
            goal: 'Some goal.',
          }),
        },
        accessToken,
      );

      expect(response.status).toBe(400);
    });

    it('should reject missing goal', async () => {
      const response = await authenticatedRequest(
        `/tests/${conversationTestId}/scenarios`,
        {
          method: 'POST',
          body: JSON.stringify({
            personaId,
            name: 'Missing Goal',
          }),
        },
        accessToken,
      );

      expect(response.status).toBe(400);
    });

    it('should reject invalid personaId', async () => {
      const response = await authenticatedRequest(
        `/tests/${conversationTestId}/scenarios`,
        {
          method: 'POST',
          body: JSON.stringify({
            personaId: NON_EXISTENT_UUID,
            name: 'Bad Persona',
            goal: 'Some goal.',
          }),
        },
        accessToken,
      );

      expect(response.status).toBe(404);
    });

    it('should allow using a template persona', async () => {
      // Get a template persona
      const listRes = await authenticatedRequest('/personas?limit=50', {}, accessToken);
      const list = await listRes.json();
      const template = list.data.find((p: Record<string, unknown>) => p.isTemplate === true);

      const data = await createScenario(accessToken, conversationTestId, {
        personaId: template.id,
        name: `Template Persona Scenario ${Date.now()}`,
        goal: 'Test with template persona.',
      });

      expect(data.persona).toBeDefined();
      expect(data.persona.isTemplate).toBe(true);
    });
  });

  describe('GET /api/tests/:id/scenarios', () => {
    it('should list scenarios for a test', async () => {
      const response = await authenticatedRequest(
        `/tests/${conversationTestId}/scenarios`,
        {},
        accessToken,
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);

      // Should be ordered by orderIndex
      for (let i = 1; i < data.length; i++) {
        expect(data[i].orderIndex).toBeGreaterThanOrEqual(data[i - 1].orderIndex);
      }
    });

    it('should return 404 for non-existent test', async () => {
      const response = await authenticatedRequest(
        `/tests/${NON_EXISTENT_UUID}/scenarios`,
        {},
        accessToken,
      );
      expectNotFound(response);
    });
  });

  describe('PUT /api/tests/:id/scenarios/:scenarioId', () => {
    it('should update a scenario', async () => {
      const scenario = await createScenario(accessToken, conversationTestId, {
        personaId,
        name: `Update Me ${Date.now()}`,
        goal: 'Original goal.',
      });

      const response = await authenticatedRequest(
        `/tests/${conversationTestId}/scenarios/${scenario.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name: 'Updated Scenario Name',
            goal: 'Updated goal.',
            maxTurns: 50,
          }),
        },
        accessToken,
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.name).toBe('Updated Scenario Name');
      expect(data.goal).toBe('Updated goal.');
      expect(data.maxTurns).toBe(50);
    });

    it('should update persona reference', async () => {
      const scenario = await createScenario(accessToken, conversationTestId, {
        personaId,
        name: `Change Persona ${Date.now()}`,
        goal: 'Change my persona.',
      });

      const newPersona = await createPersona(accessToken, {
        name: `New Persona ${Date.now()}`,
      });

      const response = await authenticatedRequest(
        `/tests/${conversationTestId}/scenarios/${scenario.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({ personaId: newPersona.id }),
        },
        accessToken,
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.personaId).toBe(newPersona.id);
    });

    it('should return 404 for non-existent scenario', async () => {
      const response = await authenticatedRequest(
        `/tests/${conversationTestId}/scenarios/${NON_EXISTENT_UUID}`,
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Does not exist' }),
        },
        accessToken,
      );
      expectNotFound(response);
    });
  });

  describe('PUT /api/tests/:id/scenarios/reorder', () => {
    it('should reorder scenarios', async () => {
      // Create a fresh conversation test for clean reorder testing
      const test = await createTest(accessToken, {
        name: `Reorder Test ${Date.now()}`,
        type: 'conversation',
        executionMode: 'sequential',
      });

      const s1 = await createScenario(accessToken, test.id as string, {
        personaId,
        name: 'First',
        goal: 'First scenario.',
      });
      const s2 = await createScenario(accessToken, test.id as string, {
        personaId,
        name: 'Second',
        goal: 'Second scenario.',
      });
      const s3 = await createScenario(accessToken, test.id as string, {
        personaId,
        name: 'Third',
        goal: 'Third scenario.',
      });

      // Reorder: Third, First, Second
      const response = await authenticatedRequest(
        `/tests/${test.id}/scenarios/reorder`,
        {
          method: 'PUT',
          body: JSON.stringify({
            scenarioIds: [s3.id, s1.id, s2.id],
          }),
        },
        accessToken,
      );

      expect(response.status).toBe(200);

      // Verify order
      const listRes = await authenticatedRequest(
        `/tests/${test.id}/scenarios`,
        {},
        accessToken,
      );
      const scenarios = await listRes.json();
      expect(scenarios[0].id).toBe(s3.id);
      expect(scenarios[1].id).toBe(s1.id);
      expect(scenarios[2].id).toBe(s2.id);
    });

    it('should reject scenario IDs from another test', async () => {
      const otherTest = await createTest(accessToken, {
        name: `Other Test ${Date.now()}`,
        type: 'conversation',
        executionMode: 'sequential',
      });

      const scenario = await createScenario(accessToken, otherTest.id as string, {
        personaId,
        name: 'Other Test Scenario',
        goal: 'Some goal.',
      });

      const response = await authenticatedRequest(
        `/tests/${conversationTestId}/scenarios/reorder`,
        {
          method: 'PUT',
          body: JSON.stringify({
            scenarioIds: [scenario.id],
          }),
        },
        accessToken,
      );

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/tests/:id/scenarios/:scenarioId', () => {
    it('should delete a scenario', async () => {
      const scenario = await createScenario(accessToken, conversationTestId, {
        personaId,
        name: `Delete Me ${Date.now()}`,
        goal: 'To be deleted.',
      });

      const response = await authenticatedRequest(
        `/tests/${conversationTestId}/scenarios/${scenario.id}`,
        { method: 'DELETE' },
        accessToken,
      );

      expect(response.status).toBe(200);

      // Verify it's gone from the list
      const listRes = await authenticatedRequest(
        `/tests/${conversationTestId}/scenarios`,
        {},
        accessToken,
      );
      const scenarios = await listRes.json();
      expect(scenarios.find((s: Record<string, unknown>) => s.id === scenario.id)).toBeUndefined();
    });

    it('should return 404 for non-existent scenario', async () => {
      const response = await authenticatedRequest(
        `/tests/${conversationTestId}/scenarios/${NON_EXISTENT_UUID}`,
        { method: 'DELETE' },
        accessToken,
      );
      expectNotFound(response);
    });
  });

  describe('Cascade behaviors', () => {
    it('should cascade delete scenarios when test is deleted', async () => {
      const test = await createTest(accessToken, {
        name: `Cascade Test ${Date.now()}`,
        type: 'conversation',
        executionMode: 'sequential',
      });

      const scenario = await createScenario(accessToken, test.id as string, {
        personaId,
        name: 'Cascade Scenario',
        goal: 'Will be cascade deleted.',
      });

      // Delete the test
      const delRes = await authenticatedRequest(
        `/tests/${test.id}`,
        { method: 'DELETE' },
        accessToken,
      );
      expect(delRes.status).toBe(200);

      // Scenarios list should 404 since test is gone
      const listRes = await authenticatedRequest(
        `/tests/${test.id}/scenarios`,
        {},
        accessToken,
      );
      expectNotFound(listRes);
    });

    it('should set personaId to null when persona is deleted', async () => {
      const disposablePersona = await createPersona(accessToken, {
        name: `Disposable ${Date.now()}`,
      });

      const scenario = await createScenario(accessToken, conversationTestId, {
        personaId: disposablePersona.id,
        name: `Orphan Scenario ${Date.now()}`,
        goal: 'Will lose its persona.',
      });

      // Delete the persona
      await authenticatedRequest(
        `/personas/${disposablePersona.id}`,
        { method: 'DELETE' },
        accessToken,
      );

      // Scenario should still exist but with personaId = null
      const listRes = await authenticatedRequest(
        `/tests/${conversationTestId}/scenarios`,
        {},
        accessToken,
      );
      const scenarios = await listRes.json();
      const orphaned = scenarios.find((s: Record<string, unknown>) => s.id === scenario.id);
      expect(orphaned).toBeDefined();
      expect(orphaned.personaId).toBeNull();
    });
  });

  describe('Test type and scenarios on GET /api/tests/:id', () => {
    it('should include scenarios when getting a conversation test', async () => {
      const response = await authenticatedRequest(
        `/tests/${conversationTestId}`,
        {},
        accessToken,
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.type).toBe('conversation');
      expect(data.scenarios).toBeDefined();
      expect(Array.isArray(data.scenarios)).toBe(true);
    });

    it('should have type qa for default tests', async () => {
      const response = await authenticatedRequest(
        `/tests/${qaTestId}`,
        {},
        accessToken,
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.type).toBe('qa');
    });
  });

  describe('Conversation test creation', () => {
    it('should create a conversation test with all fields', async () => {
      const test = await createTest(accessToken, {
        name: `Full Conv Test ${Date.now()}`,
        type: 'conversation',
        executionMode: 'parallel',
        delayBetweenTurns: 500,
        simulatedUserModel: 'gpt-4o-mini',
        simulatedUserModelConfig: { temperature: 0.7, maxTokens: 1000 },
      });

      expect(test.type).toBe('conversation');
      expect(test.executionMode).toBe('parallel');
      expect(test.delayBetweenTurns).toBe(500);
      expect(test.simulatedUserModel).toBe('gpt-4o-mini');
      expect(test.simulatedUserModelConfig).toEqual({ temperature: 0.7, maxTokens: 1000 });
    });

    it('should default type to qa', async () => {
      const test = await createTest(accessToken, {
        name: `Default QA ${Date.now()}`,
      });

      expect(test.type).toBe('qa');
    });
  });
});
