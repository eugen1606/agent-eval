import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';
import { createPersona } from './support/factories';
import {
  NON_EXISTENT_UUID,
  expectNotFound,
  expectPaginatedList,
  expectDeleteAndVerify,
} from './support/assertions';

describe('Personas CRUD', () => {
  let accessToken: string;
  let csrfToken: string;

  beforeAll(async () => {
    const auth = await createTestUser('-personas');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  describe('POST /api/personas', () => {
    it('should create a persona with all fields', async () => {
      const data = await createPersona(accessToken, {
        name: `Create Test ${Date.now()}`,
        description: 'A confused user persona',
        systemPrompt: 'You are a confused user who asks many clarifying questions.',
      });

      expect(data.name).toContain('Create Test');
      expect(data.description).toBe('A confused user persona');
      expect(data.systemPrompt).toBe('You are a confused user who asks many clarifying questions.');
      expect(data.isTemplate).toBe(false);
      expect(data.id).toBeDefined();
    });

    it('should create a persona without optional description', async () => {
      const data = await createPersona(accessToken, {
        name: `No Desc ${Date.now()}`,
        description: undefined,
      });

      expect(data.name).toContain('No Desc');
      expect(data.isTemplate).toBe(false);
    });

    it('should reject empty name', async () => {
      const response = await authenticatedRequest('/personas', {
        method: 'POST',
        body: JSON.stringify({
          name: '',
          systemPrompt: 'Some prompt',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
    });

    it('should reject missing systemPrompt', async () => {
      const response = await authenticatedRequest('/personas', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Missing Prompt',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
    });

    it('should reject duplicate name for same user', async () => {
      const uniqueName = `Duplicate Test ${Date.now()}`;
      await createPersona(accessToken, { name: uniqueName });

      const response = await authenticatedRequest('/personas', {
        method: 'POST',
        body: JSON.stringify({
          name: uniqueName,
          systemPrompt: 'Another prompt',
        }),
      }, accessToken);

      expect(response.status).toBe(409);
    });
  });

  describe('GET /api/personas', () => {
    it('should list personas with pagination', async () => {
      await createPersona(accessToken, { name: `List Test ${Date.now()}` });

      const response = await authenticatedRequest('/personas', {}, accessToken);
      await expectPaginatedList(response, { minLength: 1 });
    });

    it('should include template personas', async () => {
      const response = await authenticatedRequest('/personas', {}, accessToken);
      const result = await response.json();

      const templates = result.data.filter((p: Record<string, unknown>) => p.isTemplate === true);
      expect(templates.length).toBeGreaterThanOrEqual(1);
    });

    it('should search personas by name', async () => {
      const uniqueName = `SearchUnique ${Date.now()}`;
      await createPersona(accessToken, { name: uniqueName });

      const response = await authenticatedRequest(
        `/personas?search=${encodeURIComponent('SearchUnique')}`,
        {},
        accessToken,
      );
      const result = await response.json();

      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.data.some((p: Record<string, unknown>) => p.name === uniqueName)).toBe(true);
    });
  });

  describe('GET /api/personas/:id', () => {
    it('should get a user persona', async () => {
      const created = await createPersona(accessToken, {
        name: `Get Test ${Date.now()}`,
      });

      const response = await authenticatedRequest(`/personas/${created.id}`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.name).toBe(created.name);
    });

    it('should get a template persona', async () => {
      // First list to find a template
      const listRes = await authenticatedRequest('/personas?limit=50', {}, accessToken);
      const list = await listRes.json();
      const template = list.data.find((p: Record<string, unknown>) => p.isTemplate === true);
      expect(template).toBeDefined();

      const response = await authenticatedRequest(`/personas/${template.id}`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.isTemplate).toBe(true);
    });

    it('should return 404 for non-existent persona', async () => {
      const response = await authenticatedRequest(`/personas/${NON_EXISTENT_UUID}`, {}, accessToken);
      expectNotFound(response);
    });
  });

  describe('PUT /api/personas/:id', () => {
    it('should update a persona', async () => {
      const created = await createPersona(accessToken, {
        name: `Update Test ${Date.now()}`,
      });

      const response = await authenticatedRequest(`/personas/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: `Updated ${Date.now()}`,
          description: 'Updated description',
          systemPrompt: 'Updated system prompt.',
        }),
      }, accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.description).toBe('Updated description');
      expect(data.systemPrompt).toBe('Updated system prompt.');
    });

    it('should not allow editing template personas', async () => {
      const listRes = await authenticatedRequest('/personas?limit=50', {}, accessToken);
      const list = await listRes.json();
      const template = list.data.find((p: Record<string, unknown>) => p.isTemplate === true);

      const response = await authenticatedRequest(`/personas/${template.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Hacked Template' }),
      }, accessToken);

      expect(response.status).toBe(403);
    });

    it('should reject duplicate name on update', async () => {
      const name1 = `First ${Date.now()}`;
      const name2 = `Second ${Date.now()}`;
      await createPersona(accessToken, { name: name1 });
      const second = await createPersona(accessToken, { name: name2 });

      const response = await authenticatedRequest(`/personas/${second.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name1 }),
      }, accessToken);

      expect(response.status).toBe(409);
    });
  });

  describe('DELETE /api/personas/:id', () => {
    it('should delete a persona', async () => {
      const created = await createPersona(accessToken, {
        name: `Delete Test ${Date.now()}`,
      });

      await expectDeleteAndVerify('/personas', created.id as string, accessToken);
    });

    it('should not allow deleting template personas', async () => {
      const listRes = await authenticatedRequest('/personas?limit=50', {}, accessToken);
      const list = await listRes.json();
      const template = list.data.find((p: Record<string, unknown>) => p.isTemplate === true);

      const response = await authenticatedRequest(`/personas/${template.id}`, {
        method: 'DELETE',
      }, accessToken);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/personas/:id/clone', () => {
    it('should clone a user persona', async () => {
      const original = await createPersona(accessToken, {
        name: `Clone Source ${Date.now()}`,
        description: 'Original description',
        systemPrompt: 'Original prompt.',
      });

      const response = await authenticatedRequest(`/personas/${original.id}/clone`, {
        method: 'POST',
      }, accessToken);

      expect(response.status).toBe(201);
      const cloned = await response.json();

      expect(cloned.id).not.toBe(original.id);
      expect(cloned.name).toContain('(Copy)');
      expect(cloned.description).toBe('Original description');
      expect(cloned.systemPrompt).toBe('Original prompt.');
      expect(cloned.isTemplate).toBe(false);
    });

    it('should clone a template persona', async () => {
      const listRes = await authenticatedRequest('/personas?limit=50', {}, accessToken);
      const list = await listRes.json();
      const template = list.data.find((p: Record<string, unknown>) => p.isTemplate === true);

      const response = await authenticatedRequest(`/personas/${template.id}/clone`, {
        method: 'POST',
      }, accessToken);

      expect(response.status).toBe(201);
      const cloned = await response.json();

      expect(cloned.isTemplate).toBe(false);
      expect(cloned.name).toContain('(Copy)');
      expect(cloned.systemPrompt).toBe(template.systemPrompt);
    });
  });

  describe('Data isolation', () => {
    it('should not allow access to another user\'s persona', async () => {
      const auth2 = await createTestUser('-personas-isolation');

      const persona = await createPersona(accessToken, {
        name: `Isolated ${Date.now()}`,
      });

      // Other user cannot get it
      const getRes = await authenticatedRequest(`/personas/${persona.id}`, {}, auth2.accessToken);
      expectNotFound(getRes);

      // Other user cannot update it
      const putRes = await authenticatedRequest(`/personas/${persona.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Hacked' }),
      }, auth2.accessToken);
      expect(putRes.status).toBe(404);

      // Other user cannot delete it
      const delRes = await authenticatedRequest(`/personas/${persona.id}`, {
        method: 'DELETE',
      }, auth2.accessToken);
      expect(delRes.status).toBe(404);

      await deleteTestUser(auth2.accessToken, auth2.csrfToken);
    });
  });
});
