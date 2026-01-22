import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';

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
      const response = await authenticatedRequest('/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Tag',
          color: '#3B82F6',
        }),
      }, accessToken);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Test Tag');
      expect(data.color).toBe('#3B82F6');
    });

    it('should reject duplicate tag name', async () => {
      // Create first tag
      await authenticatedRequest('/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Duplicate Tag',
          color: '#EF4444',
        }),
      }, accessToken);

      // Try to create duplicate
      const response = await authenticatedRequest('/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Duplicate Tag',
          color: '#10B981',
        }),
      }, accessToken);

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.message).toContain('already exists');
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
      // Create a tag first
      await authenticatedRequest('/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: 'List Test Tag',
          color: '#F59E0B',
        }),
      }, accessToken);

      const response = await authenticatedRequest('/tags', {}, accessToken);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.pagination).toBeDefined();
    });

    it('should filter tags by search', async () => {
      const uniqueName = `Searchable-${Date.now()}`;
      await authenticatedRequest('/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: uniqueName,
          color: '#8B5CF6',
        }),
      }, accessToken);

      const response = await authenticatedRequest(`/tags?search=${uniqueName}`, {}, accessToken);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.data.length).toBe(1);
      expect(result.data[0].name).toBe(uniqueName);
    });
  });

  describe('GET /api/tags/:id', () => {
    it('should get a single tag', async () => {
      const createRes = await authenticatedRequest('/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Get Test Tag',
          color: '#EC4899',
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/tags/${created.id}`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.name).toBe('Get Test Tag');
      expect(data.color).toBe('#EC4899');
    });

    it('should return 404 for non-existent tag', async () => {
      const response = await authenticatedRequest('/tags/00000000-0000-0000-0000-000000000000', {}, accessToken);
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/tags/:id', () => {
    it('should update a tag', async () => {
      const createRes = await authenticatedRequest('/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Update Test Tag',
          color: '#06B6D4',
        }),
      }, accessToken);
      const created = await createRes.json();

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
      // Create two tags
      await authenticatedRequest('/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: 'First Tag For Update Test',
        }),
      }, accessToken);

      const secondRes = await authenticatedRequest('/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Second Tag For Update Test',
        }),
      }, accessToken);
      const second = await secondRes.json();

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
      const createRes = await authenticatedRequest('/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Delete Test Tag',
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/tags/${created.id}`, {
        method: 'DELETE',
      }, accessToken);

      expect(response.status).toBe(200);

      // Verify it's deleted
      const getRes = await authenticatedRequest(`/tags/${created.id}`, {}, accessToken);
      expect(getRes.status).toBe(404);
    });
  });

  describe('GET /api/tags/:id/usage', () => {
    it('should return empty usage for unused tag', async () => {
      const createRes = await authenticatedRequest('/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Unused Tag',
        }),
      }, accessToken);
      const created = await createRes.json();

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

    // Create a flow config for tests
    const flowConfigRes = await authenticatedRequest('/flow-configs', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Tags Test Flow Config',
        flowId: 'test-flow',
        basePath: 'https://test.com',
      }),
    }, accessToken);
    const flowConfig = await flowConfigRes.json();
    flowConfigId = flowConfig.id;

    // Create a tag
    const tagRes = await authenticatedRequest('/tags', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Integration Tag',
        color: '#3B82F6',
      }),
    }, accessToken);
    const tag = await tagRes.json();
    tagId = tag.id;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  it('should create test with tags', async () => {
    const response = await authenticatedRequest('/tests', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test With Tags',
        flowConfigId,
        tagIds: [tagId],
      }),
    }, accessToken);

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.tags).toBeDefined();
    expect(data.tags).toHaveLength(1);
    expect(data.tags[0].id).toBe(tagId);
    expect(data.tags[0].name).toBe('Integration Tag');
  });

  it('should update test tags', async () => {
    // Create test without tags
    const createRes = await authenticatedRequest('/tests', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test To Update Tags',
        flowConfigId,
      }),
    }, accessToken);
    const created = await createRes.json();
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
    // Create test with tag
    const createRes = await authenticatedRequest('/tests', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test To Remove Tags',
        flowConfigId,
        tagIds: [tagId],
      }),
    }, accessToken);
    const created = await createRes.json();
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
    // Create a new tag for filtering test
    const filterTagRes = await authenticatedRequest('/tags', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Filter Tag',
        color: '#10B981',
      }),
    }, accessToken);
    const filterTag = await filterTagRes.json();

    // Create test with this tag
    const testRes = await authenticatedRequest('/tests', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Filtered Test',
        flowConfigId,
        tagIds: [filterTag.id],
      }),
    }, accessToken);
    const test = await testRes.json();

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
    // Create test with tag
    const testRes = await authenticatedRequest('/tests', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test For Usage Check',
        flowConfigId,
        tagIds: [tagId],
      }),
    }, accessToken);
    const test = await testRes.json();

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
        tagIds: ['00000000-0000-0000-0000-000000000000'],
      }),
    }, accessToken);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.message).toContain('tags not found');
  });
});
