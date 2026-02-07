import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';
import { createFlowConfig, createTest, createTag } from './support/factories';
import {
  NON_EXISTENT_UUID,
  expectNotFound,
  expectPaginatedList,
  expectConflict,
  expectDeleteAndVerify,
} from './support/assertions';

describe('Tags CRUD', () => {
  let accessToken: string;
  let csrfToken: string;

  beforeAll(async () => {
    const auth = await createTestUser('-tags');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  describe('POST /api/tags', () => {
    it('should create a tag', async () => {
      const data = await createTag(accessToken);

      expect(data.name).toBe('Test Tag');
      expect(data.color).toBe('#3B82F6');
    });

    it('should reject duplicate tag name', async () => {
      await createTag(accessToken, { name: 'Duplicate Tag', color: '#EF4444' });

      // Try to create duplicate
      const response = await authenticatedRequest('/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Duplicate Tag',
          color: '#10B981',
        }),
      }, accessToken);

      await expectConflict(response, 'already exists');
    });

    it('should reject empty tag name', async () => {
      const response = await authenticatedRequest('/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: '',
          color: '#3B82F6',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
    });

    it('should reject invalid color format', async () => {
      const response = await authenticatedRequest('/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Invalid Color Tag',
          color: 'not-a-color',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('color');
    });

    it('should create tag without color', async () => {
      const response = await authenticatedRequest('/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: 'No Color Tag',
        }),
      }, accessToken);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.name).toBe('No Color Tag');
    });
  });

  describe('GET /api/tags', () => {
    it('should list tags', async () => {
      await createTag(accessToken, { name: 'List Test Tag', color: '#F59E0B' });

      const response = await authenticatedRequest('/tags', {}, accessToken);
      await expectPaginatedList(response, { minLength: 1 });
    });

    it('should filter tags by search', async () => {
      const uniqueName = `Searchable-${Date.now()}`;
      await createTag(accessToken, { name: uniqueName, color: '#8B5CF6' });

      const response = await authenticatedRequest(`/tags?search=${uniqueName}`, {}, accessToken);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.data.length).toBe(1);
      expect(result.data[0].name).toBe(uniqueName);
    });
  });

  describe('GET /api/tags/:id', () => {
    it('should get a single tag', async () => {
      const created = await createTag(accessToken, {
        name: 'Get Test Tag',
        color: '#EC4899',
      });

      const response = await authenticatedRequest(`/tags/${created.id}`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.name).toBe('Get Test Tag');
      expect(data.color).toBe('#EC4899');
    });

    it('should return 404 for non-existent tag', async () => {
      const response = await authenticatedRequest(`/tags/${NON_EXISTENT_UUID}`, {}, accessToken);
      expectNotFound(response);
    });
  });

  describe('PUT /api/tags/:id', () => {
    it('should update a tag', async () => {
      const created = await createTag(accessToken, {
        name: 'Update Test Tag',
        color: '#06B6D4',
      });

      const response = await authenticatedRequest(`/tags/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Tag Name',
          color: '#F97316',
        }),
      }, accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.name).toBe('Updated Tag Name');
      expect(data.color).toBe('#F97316');
    });

    it('should reject duplicate name on update', async () => {
      await createTag(accessToken, { name: 'First Tag For Update Test' });

      const second = await createTag(accessToken, { name: 'Second Tag For Update Test' });

      // Try to rename second to match first
      const response = await authenticatedRequest(`/tags/${second.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'First Tag For Update Test',
        }),
      }, accessToken);

      expect(response.status).toBe(409);
    });
  });

  describe('DELETE /api/tags/:id', () => {
    it('should delete a tag', async () => {
      const created = await createTag(accessToken, { name: 'Delete Test Tag' });
      await expectDeleteAndVerify('/tags', created.id as string, accessToken);
    });
  });

  describe('GET /api/tags/:id/usage', () => {
    it('should return empty usage for unused tag', async () => {
      const created = await createTag(accessToken, { name: 'Unused Tag' });

      const response = await authenticatedRequest(`/tags/${created.id}/usage`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.tests).toEqual([]);
    });
  });
});

describe('Tags with Tests', () => {
  let accessToken: string;
  let csrfToken: string;
  let tagId: string;
  let flowConfigId: string;

  beforeAll(async () => {
    const auth = await createTestUser('-tags-tests');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;

    const flowConfig = await createFlowConfig(accessToken, {
      name: 'Tags Test Flow Config',
      flowId: 'test-flow',
      basePath: 'https://test.com',
    });
    flowConfigId = flowConfig.id as string;

    const tag = await createTag(accessToken, {
      name: 'Integration Tag',
      color: '#3B82F6',
    });
    tagId = tag.id as string;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  it('should create test with tags', async () => {
    const data = await createTest(accessToken, {
      name: 'Test With Tags',
      flowConfigId,
      tagIds: [tagId],
    });

    expect(data.tags).toBeDefined();
    expect(data.tags).toHaveLength(1);
    expect((data.tags as Array<{ id: string; name: string }>)[0].id).toBe(tagId);
    expect((data.tags as Array<{ id: string; name: string }>)[0].name).toBe('Integration Tag');
  });

  it('should update test tags', async () => {
    const created = await createTest(accessToken, {
      name: 'Test To Update Tags',
      flowConfigId,
    });
    expect(created.tags).toEqual([]);

    // Update with tags
    const updateRes = await authenticatedRequest(`/tests/${created.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        tagIds: [tagId],
      }),
    }, accessToken);

    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.tags).toHaveLength(1);
    expect(updated.tags[0].id).toBe(tagId);
  });

  it('should remove test tags', async () => {
    const created = await createTest(accessToken, {
      name: 'Test To Remove Tags',
      flowConfigId,
      tagIds: [tagId],
    });
    expect(created.tags).toHaveLength(1);

    // Update to remove tags
    const updateRes = await authenticatedRequest(`/tests/${created.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        tagIds: [],
      }),
    }, accessToken);

    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.tags).toEqual([]);
  });

  it('should filter tests by tag', async () => {
    const filterTag = await createTag(accessToken, {
      name: 'Filter Tag',
      color: '#10B981',
    });

    const test = await createTest(accessToken, {
      name: 'Filtered Test',
      flowConfigId,
      tagIds: [filterTag.id],
    });

    // Filter tests by tag
    const response = await authenticatedRequest(`/tests?tagIds=${filterTag.id}`, {}, accessToken);
    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.data.some((t: { id: string }) => t.id === test.id)).toBe(true);
    // All returned tests should have the filter tag
    result.data.forEach((t: { tags?: { id: string }[] }) => {
      expect(t.tags?.some((tag) => tag.id === filterTag.id)).toBe(true);
    });
  });

  it('should show tag usage', async () => {
    const test = await createTest(accessToken, {
      name: 'Test For Usage Check',
      flowConfigId,
      tagIds: [tagId],
    });

    // Check tag usage
    const response = await authenticatedRequest(`/tags/${tagId}/usage`, {}, accessToken);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.tests.some((t: { id: string }) => t.id === test.id)).toBe(true);
  });

  it('should reject invalid tag IDs', async () => {
    const response = await authenticatedRequest('/tests', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test With Invalid Tags',
        flowConfigId,
        tagIds: [NON_EXISTENT_UUID],
      }),
    }, accessToken);

    expectNotFound(response);
    const data = await response.json();
    expect(data.message).toContain('tags not found');
  });
});
