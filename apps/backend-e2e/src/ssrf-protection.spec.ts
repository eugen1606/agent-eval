import { authenticatedRequest, createTestUser } from './support/test-setup';

describe('SSRF Protection', () => {
  let accessToken: string;

  beforeAll(async () => {
    const auth = await createTestUser('-ssrf');
    accessToken = auth.accessToken;
  });

  describe('Tests endpoint - basePath validation', () => {
    it('should allow valid HTTPS URLs', async () => {
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Valid HTTPS Test',
          flowId: 'test-flow',
          basePath: 'https://api.example.com',
        }),
      }, accessToken);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.basePath).toBe('https://api.example.com');
    });

    it('should allow valid HTTP URLs in development', async () => {
      // In development mode, HTTP URLs should be allowed
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Valid HTTP Test',
          flowId: 'test-flow',
          basePath: 'http://api.example.com',
        }),
      }, accessToken);

      expect(response.status).toBe(201);
    });

    it('should allow localhost in development mode', async () => {
      // In development, localhost should be allowed
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Localhost Test',
          flowId: 'test-flow',
          basePath: 'http://localhost:3000',
        }),
      }, accessToken);

      expect(response.status).toBe(201);
    });

    it('should block cloud metadata endpoint (169.254.169.254)', async () => {
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Metadata Attack Test',
          flowId: 'test-flow',
          basePath: 'http://169.254.169.254/latest/meta-data',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('cloud metadata');
    });

    it('should block Google metadata endpoint', async () => {
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Google Metadata Attack Test',
          flowId: 'test-flow',
          basePath: 'http://metadata.google.internal',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('cloud metadata');
    });

    it('should block link-local IP range (169.254.x.x)', async () => {
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Link Local Attack Test',
          flowId: 'test-flow',
          basePath: 'http://169.254.1.1',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('cloud metadata');
    });

    it('should reject invalid URL format', async () => {
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Invalid URL Test',
          flowId: 'test-flow',
          basePath: 'not-a-valid-url',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('invalid format');
    });

    it('should reject non-HTTP/HTTPS protocols', async () => {
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'FTP Protocol Test',
          flowId: 'test-flow',
          basePath: 'ftp://ftp.example.com',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('HTTP or HTTPS');
    });

    it('should reject file protocol', async () => {
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'File Protocol Test',
          flowId: 'test-flow',
          basePath: 'file:///etc/passwd',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('HTTP or HTTPS');
    });

    it('should validate basePath on update', async () => {
      // First create a valid test
      const createRes = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Update SSRF Test',
          flowId: 'test-flow',
          basePath: 'https://api.example.com',
        }),
      }, accessToken);
      const created = await createRes.json();

      // Try to update with a malicious basePath
      const response = await authenticatedRequest(`/tests/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          basePath: 'http://169.254.169.254',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('cloud metadata');
    });
  });

  describe('Webhooks endpoint - URL validation', () => {
    const validWebhookPayload = {
      name: 'Test Webhook',
      events: ['run.completed'],
      method: 'POST',
      bodyTemplate: { event: '{{event}}' },
    };

    it('should allow valid HTTPS webhook URLs', async () => {
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          url: 'https://webhook.example.com/callback',
        }),
      }, accessToken);

      expect(response.status).toBe(201);
    });

    it('should block cloud metadata in webhook URLs', async () => {
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          url: 'http://169.254.169.254/latest/meta-data',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('cloud metadata');
    });

    it('should block Google metadata endpoint in webhook URLs', async () => {
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          url: 'http://metadata.google.internal/computeMetadata/v1/',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('cloud metadata');
    });

    it('should block link-local IP range in webhook URLs', async () => {
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          url: 'http://169.254.100.50:8080/webhook',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('cloud metadata');
    });

    it('should validate webhook URL on update', async () => {
      // First create a valid webhook
      const createRes = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          url: 'https://webhook.example.com/callback',
        }),
      }, accessToken);
      const created = await createRes.json();

      // Try to update with a malicious URL
      const response = await authenticatedRequest(`/webhooks/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          url: 'http://169.254.169.254',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('cloud metadata');
    });

    it('should allow localhost webhook URLs in development', async () => {
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          url: 'http://localhost:8080/webhook',
        }),
      }, accessToken);

      expect(response.status).toBe(201);
    });

    it('should allow private IPs in webhook URLs in development', async () => {
      const response = await authenticatedRequest('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          ...validWebhookPayload,
          url: 'http://192.168.1.100:3000/webhook',
        }),
      }, accessToken);

      expect(response.status).toBe(201);
    });
  });

  describe('Protocol validation', () => {
    it('should reject javascript: protocol in basePath', async () => {
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'JS Protocol Test',
          flowId: 'test-flow',
          basePath: 'javascript:alert(1)',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
    });

    it('should reject data: protocol in basePath', async () => {
      const response = await authenticatedRequest('/tests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Data Protocol Test',
          flowId: 'test-flow',
          basePath: 'data:text/html,<script>alert(1)</script>',
        }),
      }, accessToken);

      expect(response.status).toBe(400);
    });
  });
});
