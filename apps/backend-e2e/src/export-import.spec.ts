import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';
import { createFlowConfig, createTest, createRun, createQuestionSet, createTag, createAccessToken } from './support/factories';

describe('Export/Import', () => {
  let accessToken: string;
  let csrfToken: string;
  let flowConfigId: string;
  let questionSetId: string;
  let tagId: string;
  let testId: string;
  let runId: string;

  beforeAll(async () => {
    const auth = await createTestUser('-export-import');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;

    const flowConfig = await createFlowConfig(accessToken, {
      name: 'Export Test Flow Config',
      flowId: 'export-test-flow',
      basePath: 'https://export-test.com',
      description: 'Flow config for export tests',
    });
    flowConfigId = flowConfig.id as string;

    const questionSet = await createQuestionSet(accessToken, {
      name: 'Export Test Questions',
      description: 'Question set for export tests',
      questions: [
        { question: 'What is 2+2?', expectedAnswer: '4' },
        { question: 'What is 3+3?', expectedAnswer: '6' },
      ],
    });
    questionSetId = questionSet.id as string;

    const tag = await createTag(accessToken, {
      name: 'Export Test Tag',
      color: '#3B82F6',
    });
    tagId = tag.id as string;

    const test = await createTest(accessToken, {
      name: 'Export Test',
      description: 'Test for export functionality',
      flowConfigId,
      questionSetId,
      tagIds: [tagId],
      multiStepEvaluation: true,
    });
    testId = test.id as string;

    const run = await createRun(accessToken, {
      testId,
      results: [
        { question: 'What is 2+2?', answer: '4', expectedAnswer: '4', humanEvaluation: 'correct' },
        { question: 'What is 3+3?', answer: '6', expectedAnswer: '6', humanEvaluation: 'correct' },
      ],
      status: 'completed',
      totalQuestions: 2,
      completedQuestions: 2,
    });
    runId = run.id as string;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  describe('GET /api/export', () => {
    it('should export all entity types', async () => {
      const response = await authenticatedRequest(
        '/export?types=tests&types=questionSets&types=flowConfigs&types=tags',
        {},
        accessToken
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.metadata).toBeDefined();
      expect(data.metadata.version).toBe('1.0.0');
      expect(data.metadata.exportedAt).toBeDefined();
      expect(data.tests).toBeDefined();
      expect(data.questionSets).toBeDefined();
      expect(data.flowConfigs).toBeDefined();
      expect(data.tags).toBeDefined();
    });

    it('should export only requested types', async () => {
      const response = await authenticatedRequest(
        '/export?types=questionSets',
        {},
        accessToken
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.questionSets).toBeDefined();
      expect(data.tests).toBeUndefined();
      expect(data.flowConfigs).toBeUndefined();
      expect(data.tags).toBeUndefined();
    });

    it('should export specific items by ID', async () => {
      const response = await authenticatedRequest(
        `/export?types=tests&testIds=${testId}`,
        {},
        accessToken
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.tests).toHaveLength(1);
      expect(data.tests[0].name).toBe('Export Test');
    });

    it('should use export IDs instead of real IDs', async () => {
      const response = await authenticatedRequest(
        '/export?types=tests&types=flowConfigs&types=questionSets&types=tags',
        {},
        accessToken
      );

      const data = await response.json();

      // Check that tests have export IDs
      expect(data.tests[0].exportId).toBeDefined();
      expect(data.tests[0].exportId).not.toBe(testId);

      // Check that references are using export IDs
      if (data.tests[0].flowConfigExportId) {
        const flowConfigExportIds = data.flowConfigs.map((fc: { exportId: string }) => fc.exportId);
        expect(flowConfigExportIds).toContain(data.tests[0].flowConfigExportId);
      }
    });

    it('should not include access token values', async () => {
      // Create an access token
      await createAccessToken(accessToken, {
        name: 'Export Test Token',
        token: 'secret-token-value',
      });

      // Export all types (no accessTokens type supported)
      const response = await authenticatedRequest(
        '/export?types=tests&types=questionSets&types=flowConfigs&types=tags',
        {},
        accessToken
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      const json = JSON.stringify(data);
      expect(json).not.toContain('secret-token-value');
    });

    it('should require at least one type', async () => {
      const response = await authenticatedRequest('/export', {}, accessToken);
      expect(response.status).toBe(400);
    });

    it('should export runs', async () => {
      const response = await authenticatedRequest(
        '/export?types=runs',
        {},
        accessToken
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.runs).toBeDefined();
      expect(data.runs.length).toBeGreaterThan(0);
      expect(data.runs[0].exportId).toBeDefined();
      expect(data.runs[0].status).toBe('completed');
      expect(data.runs[0].results).toBeDefined();
    });

    it('should export specific run by ID', async () => {
      const response = await authenticatedRequest(
        `/export?types=runs&runIds=${runId}`,
        {},
        accessToken
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.runs).toHaveLength(1);
      expect(data.runs[0].results).toHaveLength(2);
    });

    it('should include test reference in run export', async () => {
      const response = await authenticatedRequest(
        `/export?types=runs&types=tests&runIds=${runId}`,
        {},
        accessToken
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.runs[0].testExportId).toBeDefined();
      expect(data.tests).toBeDefined();

      // Verify the test reference matches
      const testExportIds = data.tests.map((t: { exportId: string }) => t.exportId);
      expect(testExportIds).toContain(data.runs[0].testExportId);
    });

    it('should export run results with evaluations', async () => {
      const response = await authenticatedRequest(
        `/export?types=runs&runIds=${runId}`,
        {},
        accessToken
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      const run = data.runs[0];
      expect(run.results[0].humanEvaluation).toBe('correct');
    });
  });

  describe('POST /api/export/preview', () => {
    it('should preview import without conflicts', async () => {
      // Create a new user for clean import
      const auth2 = await createTestUser('-import-preview');

      const exportRes = await authenticatedRequest(
        '/export?types=tests&types=flowConfigs&types=questionSets&types=tags',
        {},
        accessToken
      );
      const bundle = await exportRes.json();

      const response = await authenticatedRequest('/export/preview', {
        method: 'POST',
        body: JSON.stringify(bundle),
      }, auth2.accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.toCreate).toBeDefined();
      expect(data.conflicts).toEqual([]);
      expect(data.errors).toEqual([]);

      await deleteTestUser(auth2.accessToken, auth2.csrfToken);
    });

    it('should detect conflicts', async () => {
      // Preview import into same user (will have conflicts)
      const exportRes = await authenticatedRequest(
        '/export?types=tests&types=flowConfigs&types=questionSets&types=tags',
        {},
        accessToken
      );
      const bundle = await exportRes.json();

      const response = await authenticatedRequest('/export/preview', {
        method: 'POST',
        body: JSON.stringify(bundle),
      }, accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.conflicts.length).toBeGreaterThan(0);
      expect(data.conflicts.some((c: { type: string }) => c.type === 'tests')).toBe(true);
    });

    it('should validate bundle version', async () => {
      const invalidBundle = {
        metadata: { version: '99.0.0', exportedAt: new Date().toISOString() },
        tests: [],
      };

      const response = await authenticatedRequest('/export/preview', {
        method: 'POST',
        body: JSON.stringify(invalidBundle),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('version');
    });
  });

  describe('POST /api/export/import', () => {
    it('should import with skip strategy', async () => {
      const auth2 = await createTestUser('-import-skip');

      // Export from user 1
      const exportRes = await authenticatedRequest(
        '/export?types=flowConfigs',
        {},
        accessToken
      );
      const bundle = await exportRes.json();

      // Import to user 2
      const response = await authenticatedRequest('/export/import', {
        method: 'POST',
        body: JSON.stringify({
          bundle,
          options: { conflictStrategy: 'skip' },
        }),
      }, auth2.accessToken);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.created.flowConfigs).toBeGreaterThan(0);
      expect(data.skipped.flowConfigs).toBe(0);
      expect(data.errors).toEqual([]);

      // Verify data was imported
      const flowConfigsRes = await authenticatedRequest('/flow-configs', {}, auth2.accessToken);
      const flowConfigs = await flowConfigsRes.json();
      expect(flowConfigs.data.some((fc: { name: string }) => fc.name === 'Export Test Flow Config')).toBe(true);

      await deleteTestUser(auth2.accessToken, auth2.csrfToken);
    });

    it('should skip existing on conflict with skip strategy', async () => {
      const auth2 = await createTestUser('-import-skip-conflict');

      // Export from user 1
      const exportRes = await authenticatedRequest(
        '/export?types=flowConfigs',
        {},
        accessToken
      );
      const bundle = await exportRes.json();

      // First import
      await authenticatedRequest('/export/import', {
        method: 'POST',
        body: JSON.stringify({
          bundle,
          options: { conflictStrategy: 'skip' },
        }),
      }, auth2.accessToken);

      // Second import (same data)
      const response = await authenticatedRequest('/export/import', {
        method: 'POST',
        body: JSON.stringify({
          bundle,
          options: { conflictStrategy: 'skip' },
        }),
      }, auth2.accessToken);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.created.flowConfigs).toBe(0);
      expect(data.skipped.flowConfigs).toBeGreaterThan(0);

      await deleteTestUser(auth2.accessToken, auth2.csrfToken);
    });

    it('should overwrite existing on conflict with overwrite strategy', async () => {
      const auth2 = await createTestUser('-import-overwrite');

      // Create initial flow config
      await createFlowConfig(auth2.accessToken, {
        name: 'Export Test Flow Config',
        flowId: 'original-flow',
        basePath: 'https://original.com',
      });

      // Export from user 1
      const exportRes = await authenticatedRequest(
        '/export?types=flowConfigs',
        {},
        accessToken
      );
      const bundle = await exportRes.json();

      // Import with overwrite
      const response = await authenticatedRequest('/export/import', {
        method: 'POST',
        body: JSON.stringify({
          bundle,
          options: { conflictStrategy: 'overwrite' },
        }),
      }, auth2.accessToken);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.overwritten.flowConfigs).toBeGreaterThan(0);

      // Verify data was overwritten
      const flowConfigsRes = await authenticatedRequest('/flow-configs', {}, auth2.accessToken);
      const flowConfigs = await flowConfigsRes.json();
      const imported = flowConfigs.data.find((fc: { name: string }) => fc.name === 'Export Test Flow Config');
      expect(imported.flowId).toBe('export-test-flow');
      expect(imported.basePath).toBe('https://export-test.com');

      await deleteTestUser(auth2.accessToken, auth2.csrfToken);
    });

    it('should rename on conflict with rename strategy', async () => {
      const auth2 = await createTestUser('-import-rename');

      // Create initial flow config with same name
      await createFlowConfig(auth2.accessToken, {
        name: 'Export Test Flow Config',
        flowId: 'original-flow',
        basePath: 'https://original.com',
      });

      // Export from user 1
      const exportRes = await authenticatedRequest(
        '/export?types=flowConfigs',
        {},
        accessToken
      );
      const bundle = await exportRes.json();

      // Import with rename
      const response = await authenticatedRequest('/export/import', {
        method: 'POST',
        body: JSON.stringify({
          bundle,
          options: { conflictStrategy: 'rename' },
        }),
      }, auth2.accessToken);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.renamed.flowConfigs).toBeGreaterThan(0);

      // Verify both exist
      const flowConfigsRes = await authenticatedRequest('/flow-configs', {}, auth2.accessToken);
      const flowConfigs = await flowConfigsRes.json();
      expect(flowConfigs.data.length).toBe(2);
      expect(flowConfigs.data.some((fc: { name: string }) => fc.name === 'Export Test Flow Config')).toBe(true);
      expect(flowConfigs.data.some((fc: { name: string }) => fc.name.includes('(imported)'))).toBe(true);

      await deleteTestUser(auth2.accessToken, auth2.csrfToken);
    });

    it('should preserve relationships in import', async () => {
      const auth2 = await createTestUser('-import-relations');

      // Export from user 1 (tests with dependencies)
      const exportRes = await authenticatedRequest(
        '/export?types=tests&types=flowConfigs&types=questionSets&types=tags',
        {},
        accessToken
      );
      const bundle = await exportRes.json();

      // Import to user 2
      await authenticatedRequest('/export/import', {
        method: 'POST',
        body: JSON.stringify({
          bundle,
          options: { conflictStrategy: 'skip' },
        }),
      }, auth2.accessToken);

      // Verify test has relations
      const testsRes = await authenticatedRequest('/tests', {}, auth2.accessToken);
      const tests = await testsRes.json();
      const importedTest = tests.data.find((t: { name: string }) => t.name === 'Export Test');

      expect(importedTest).toBeDefined();
      expect(importedTest.flowConfig).toBeDefined();
      expect(importedTest.flowConfig.name).toBe('Export Test Flow Config');
      expect(importedTest.questionSet).toBeDefined();
      expect(importedTest.questionSet.name).toBe('Export Test Questions');
      expect(importedTest.tags).toBeDefined();
      expect(importedTest.tags.length).toBe(1);
      expect(importedTest.tags[0].name).toBe('Export Test Tag');

      await deleteTestUser(auth2.accessToken, auth2.csrfToken);
    });

    it('should handle empty bundle', async () => {
      const emptyBundle = {
        metadata: { version: '1.0.0', exportedAt: new Date().toISOString() },
      };

      const response = await authenticatedRequest('/export/import', {
        method: 'POST',
        body: JSON.stringify({
          bundle: emptyBundle,
          options: { conflictStrategy: 'skip' },
        }),
      }, accessToken);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.created.tests).toBe(0);
      expect(data.created.flowConfigs).toBe(0);
      expect(data.created.questionSets).toBe(0);
      expect(data.created.tags).toBe(0);
    });
  });

  describe('Data Isolation', () => {
    it('should only export data belonging to the user', async () => {
      const auth2 = await createTestUser('-export-isolation');

      // Create data for user 2
      await createFlowConfig(auth2.accessToken, {
        name: 'User 2 Flow Config',
        flowId: 'user2-flow',
        basePath: 'https://user2.com',
      });

      // Export from user 1 should not include user 2's data
      const response = await authenticatedRequest(
        '/export?types=flowConfigs',
        {},
        accessToken
      );

      const data = await response.json();
      const names = data.flowConfigs.map((fc: { name: string }) => fc.name);
      expect(names).not.toContain('User 2 Flow Config');
      expect(names).toContain('Export Test Flow Config');

      await deleteTestUser(auth2.accessToken, auth2.csrfToken);
    });
  });
});
