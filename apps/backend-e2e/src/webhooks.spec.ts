import { authenticatedRequest, createTestUser } from './support/test-setup';

describe('Webhooks CRUD', () => {
  let accessToken: string;

  const validWebhookPayload = {
    name: 'Test Webhook',
    url: 'https://example.com/webhook',
    description: 'A test webhook',
    events: ['run.completed'],
    method: 'POST',
    bodyTemplate: {
      event: '{{event}}',
      runId: '{{runId}}',
    },
  };

  beforeAll(async () => {
    const auth = await createTestUser('-webhooks');
    accessToken = auth.accessToken;
  });

  describe('POST /api/webhooks', () => {
    it('should create a webhook with all fields', async () => {
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          headers: { 'Authorization': 'Bearer {{runId}}' },
          queryParams: { 'run': '{{runId}}' },
        }),
      }, accessToken);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Test Webhook');
      expect(data.url).toBe('https://example.com/webhook');
      expect(data.events).toContain('run.completed');
      expect(data.enabled).toBe(true);
      expect(data.method).toBe('POST');
      expect(data.bodyTemplate).toEqual({ event: '{{event}}', runId: '{{runId}}' });
      expect(data.headers).toEqual({ 'Authorization': 'Bearer {{runId}}' });
      expect(data.queryParams).toEqual({ 'run': '{{runId}}' });
    });

    it('should create a webhook with PUT method', async () => {
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          method: 'PUT',
        }),
      }, accessToken);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.method).toBe('PUT');
    });

    it('should create a webhook with PATCH method', async () => {
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          method: 'PATCH',
        }),
      }, accessToken);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.method).toBe('PATCH');
    });

    it('should reject invalid URL', async () => {
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          url: 'not-a-url',
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
          ...validWebhookPayload,
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
          ...validWebhookPayload,
          events: ['invalid.event'],
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('Invalid event');
    });

    it('should reject invalid HTTP method', async () => {
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          method: 'GET',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('Invalid HTTP method');
    });

    it('should reject missing body template', async () => {
      const { bodyTemplate, ...payloadWithoutBody } = validWebhookPayload;
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify(payloadWithoutBody),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('Body template is required');
    });

    it('should reject array as body template', async () => {
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          bodyTemplate: ['invalid'],
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('Body template must be a JSON object');
    });

    it('should reject missing HTTP method', async () => {
      const { method, ...payloadWithoutMethod } = validWebhookPayload;
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify(payloadWithoutMethod),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('HTTP method is required');
    });
  });

  describe('GET /api/webhooks', () => {
    it('should list webhooks', async () => {
      await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          name: 'List Test Webhook',
          url: 'https://example.com/list',
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
      expect(data.events).toContain('run.running');
      expect(data.events).toContain('run.completed');
      expect(data.events).toContain('run.failed');
      expect(data.events).toContain('run.evaluated');
    });
  });

  describe('GET /api/webhooks/variables', () => {
    it('should return available variables', async () => {
      const response = await authenticatedRequest('/webhooks/variables', {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data.variables)).toBe(true);
      expect(data.variables.length).toBeGreaterThan(0);

      const runIdVar = data.variables.find((v: { name: string }) => v.name === 'runId');
      expect(runIdVar).toBeDefined();
      expect(runIdVar.description).toBeDefined();
      expect(runIdVar.example).toBeDefined();
      expect(runIdVar.events).toContain('run.completed');

      const accuracyVar = data.variables.find((v: { name: string }) => v.name === 'accuracy');
      expect(accuracyVar).toBeDefined();
      expect(accuracyVar.events).toContain('run.evaluated');
      expect(accuracyVar.events).not.toContain('run.failed');

      const errorVar = data.variables.find((v: { name: string }) => v.name === 'errorMessage');
      expect(errorVar).toBeDefined();
      expect(errorVar.events).toContain('run.failed');
    });
  });

  describe('GET /api/webhooks/:id', () => {
    it('should get a single webhook', async () => {
      const createRes = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          name: 'Get Test Webhook',
          url: 'https://example.com/get',
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/webhooks/${created.id}`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.name).toBe('Get Test Webhook');
      expect(data.method).toBe('POST');
      expect(data.bodyTemplate).toEqual(validWebhookPayload.bodyTemplate);
    });
  });

  describe('PUT /api/webhooks/:id', () => {
    it('should update a webhook', async () => {
      const createRes = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          name: 'Update Test Webhook',
          url: 'https://example.com/update',
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/webhooks/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Webhook Name',
          events: ['run.completed', 'run.failed'],
          method: 'PUT',
          bodyTemplate: { updated: true, runId: '{{runId}}' },
        }),
      }, accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.name).toBe('Updated Webhook Name');
      expect(data.events).toContain('run.failed');
      expect(data.method).toBe('PUT');
      expect(data.bodyTemplate).toEqual({ updated: true, runId: '{{runId}}' });
    });

    it('should update headers and query params', async () => {
      const createRes = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          name: 'Headers Test Webhook',
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/webhooks/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          headers: { 'X-Custom-Header': 'test-value' },
          queryParams: { 'status': '{{runStatus}}' },
        }),
      }, accessToken);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.headers).toEqual({ 'X-Custom-Header': 'test-value' });
      expect(data.queryParams).toEqual({ 'status': '{{runStatus}}' });
    });

    it('should reject invalid method on update', async () => {
      const createRes = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify(validWebhookPayload),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/webhooks/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          method: 'DELETE',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('Invalid HTTP method');
    });
  });

  describe('POST /api/webhooks/:id/toggle', () => {
    it('should toggle webhook enabled status', async () => {
      const createRes = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          name: 'Toggle Test Webhook',
          url: 'https://example.com/toggle',
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
          ...validWebhookPayload,
          name: 'Delete Test Webhook',
          url: 'https://example.com/delete',
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
