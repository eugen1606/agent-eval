import {
  authenticatedRequest,
  createTestUser,
  deleteTestUser,
} from './support/test-setup';
import { createTest, createRun } from './support/factories';
import { NON_EXISTENT_UUID } from './support/assertions';

describe('Run Export', () => {
  let accessToken: string;
  let csrfToken: string;
  let testId: string;
  let runId: string;

  beforeAll(async () => {
    const auth = await createTestUser('-run-export');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;

    const test = await createTest(accessToken, { name: 'Export Test' });
    testId = test.id as string;

    const run = await createRun(accessToken, { testId, totalQuestions: 2 });
    runId = run.id as string;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  describe('GET /api/runs/:id/export/csv', () => {
    it('should export run as CSV', async () => {
      const response = await authenticatedRequest(
        `/runs/${runId}/export/csv`,
        {},
        accessToken,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/csv');
      expect(response.headers.get('content-disposition')).toContain('attachment');

      const body = await response.text();
      expect(body).toContain('Question');
      expect(body).toContain('Answer');
      expect(body).toContain('Expected Answer');
      expect(body).toContain('Evaluation');
    });

    it('should return 404 for non-existent run', async () => {
      const response = await authenticatedRequest(
        `/runs/${NON_EXISTENT_UUID}/export/csv`,
        {},
        accessToken,
      );

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/runs/:id/export/pdf', () => {
    it('should export run as PDF', async () => {
      const response = await authenticatedRequest(
        `/runs/${runId}/export/pdf`,
        {},
        accessToken,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/pdf');
      expect(response.headers.get('content-disposition')).toContain('attachment');

      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      // PDF files start with %PDF
      const header = String.fromCharCode(...bytes.slice(0, 5));
      expect(header).toBe('%PDF-');
    });

    it('should return 404 for non-existent run', async () => {
      const response = await authenticatedRequest(
        `/runs/${NON_EXISTENT_UUID}/export/pdf`,
        {},
        accessToken,
      );

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/runs/export/dashboard-csv', () => {
    it('should export dashboard CSV for a test', async () => {
      const response = await authenticatedRequest(
        `/runs/export/dashboard-csv?testId=${testId}`,
        {},
        accessToken,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/csv');
      expect(response.headers.get('content-disposition')).toContain('attachment');

      const body = await response.text();
      expect(body).toContain('Run ID');
      expect(body).toContain('Date');
      expect(body).toContain('Accuracy (%)');
    });

    it('should return 400 without testId', async () => {
      const response = await authenticatedRequest(
        '/runs/export/dashboard-csv',
        {},
        accessToken,
      );

      expect(response.status).toBe(400);
    });

    it('should return header-only CSV for non-existent test', async () => {
      const response = await authenticatedRequest(
        `/runs/export/dashboard-csv?testId=${NON_EXISTENT_UUID}`,
        {},
        accessToken,
      );

      expect(response.status).toBe(200);
      const body = await response.text();
      // Should have header row but no data rows
      const lines = body.trim().split('\n');
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain('Run ID');
    });
  });

  describe('User isolation', () => {
    it('should not allow exporting another user run', async () => {
      const otherAuth = await createTestUser('-run-export-other');

      const csvResponse = await authenticatedRequest(
        `/runs/${runId}/export/csv`,
        {},
        otherAuth.accessToken,
      );
      expect(csvResponse.status).toBe(404);

      const pdfResponse = await authenticatedRequest(
        `/runs/${runId}/export/pdf`,
        {},
        otherAuth.accessToken,
      );
      expect(pdfResponse.status).toBe(404);

      await deleteTestUser(otherAuth.accessToken, otherAuth.csrfToken);
    });
  });
});
