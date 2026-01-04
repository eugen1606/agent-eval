import { authenticatedRequest, createTestUser } from './support/test-setup';

describe('Webhooks CRUD', () => {
  let accessToken: string;

  beforeAll(async () => {
    const auth = await createTestUser('-webhooks');
    accessToken = auth.accessToken;
  });

  describe('POST /api/webhooks', () => {
    it('should create a webhook', async () => {
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Webhook',
          url: 'https://example.com/webhook',
          description: 'A test webhook',
          events: ['evaluation.completed'],
        }),
      }, accessToken);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Test Webhook');
      expect(data.url).toBe('https://example.com/webhook');
      expect(data.events).toContain('evaluation.completed');
      expect(data.enabled).toBe(true);
    });

    it('should reject invalid URL', async () => {
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Invalid Webhook',
          url: 'not-a-url',
          events: ['evaluation.completed'],
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('Invalid URL');
    });

    it('should reject empty events', async () => {
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          name: 'No Events Webhook',
          url: 'https://example.com/webhook',
          events: [],
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('At least one event');
    });

    it('should reject invalid event', async () => {
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Invalid Event Webhook',
          url: 'https://example.com/webhook',
          events: ['invalid.event'],
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('Invalid event');
    });
  });

  describe('GET /api/webhooks', () => {
    it('should list webhooks', async () => {
      await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          name: 'List Test Webhook',
          url: 'https://example.com/list',
          events: ['evaluation.completed'],
        }),
      }, accessToken);

      const response = await authenticatedRequest('/webhooks', {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/webhooks/events', () => {
    it('should return available events', async () => {
      const response = await authenticatedRequest('/webhooks/events', {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.events).toContain('evaluation.completed');
      expect(data.events).toContain('scheduled.completed');
      expect(data.events).toContain('scheduled.failed');
    });
  });

  describe('GET /api/webhooks/:id', () => {
    it('should get a single webhook', async () => {
      const createRes = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Get Test Webhook',
          url: 'https://example.com/get',
          events: ['evaluation.completed'],
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/webhooks/${created.id}`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.name).toBe('Get Test Webhook');
    });
  });

  describe('PUT /api/webhooks/:id', () => {
    it('should update a webhook', async () => {
      const createRes = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Update Test Webhook',
          url: 'https://example.com/update',
          events: ['evaluation.completed'],
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/webhooks/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Webhook Name',
          events: ['evaluation.completed', 'scheduled.completed'],
        }),
      }, accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.name).toBe('Updated Webhook Name');
      expect(data.events).toContain('scheduled.completed');
    });
  });

  describe('POST /api/webhooks/:id/toggle', () => {
    it('should toggle webhook enabled status', async () => {
      const createRes = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Toggle Test Webhook',
          url: 'https://example.com/toggle',
          events: ['evaluation.completed'],
        }),
      }, accessToken);
      const created = await createRes.json();
      expect(created.enabled).toBe(true);

      const response = await authenticatedRequest(`/webhooks/${created.id}/toggle`, {
        method: 'POST',
      }, accessToken);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.enabled).toBe(false);

      // Toggle again
      const response2 = await authenticatedRequest(`/webhooks/${created.id}/toggle`, {
        method: 'POST',
      }, accessToken);
      const data2 = await response2.json();
      expect(data2.enabled).toBe(true);
    });
  });

  describe('DELETE /api/webhooks/:id', () => {
    it('should delete a webhook', async () => {
      const createRes = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Delete Test Webhook',
          url: 'https://example.com/delete',
          events: ['evaluation.completed'],
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/webhooks/${created.id}`, {
        method: 'DELETE',
      }, accessToken);

      expect(response.status).toBe(200);

      const getRes = await authenticatedRequest(`/webhooks/${created.id}`, {}, accessToken);
      expect(getRes.status).toBe(404);
    });
  });
});
