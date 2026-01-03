import { authenticatedRequest, createTestUser } from './support/test-setup';

describe('Question Sets CRUD', () => {
  let accessToken: string;

  beforeAll(async () => {
    const auth = await createTestUser('-questions');
    accessToken = auth.accessToken;
  });

  describe('POST /api/questions', () => {
    it('should create a question set', async () => {
      const response = await authenticatedRequest('/questions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Question Set',
          description: 'A test question set',
          questions: [
            { question: 'What is 2+2?', expectedAnswer: '4' },
            { question: 'What is the capital of France?', expectedAnswer: 'Paris' },
          ],
        }),
      }, accessToken);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Test Question Set');
      expect(data.questions).toHaveLength(2);
    });
  });

  describe('GET /api/questions', () => {
    it('should list question sets', async () => {
      // Create a question set first
      await authenticatedRequest('/questions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'List Test',
          questions: [{ question: 'Test?' }],
        }),
      }, accessToken);

      const response = await authenticatedRequest('/questions', {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/questions/:id', () => {
    it('should get a single question set', async () => {
      const createRes = await authenticatedRequest('/questions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Get Test',
          questions: [{ question: 'Test?' }],
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/questions/${created.id}`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.name).toBe('Get Test');
    });

    it('should return 404 for non-existent question set', async () => {
      // Use a valid UUID format that doesn't exist
      const response = await authenticatedRequest('/questions/00000000-0000-0000-0000-000000000000', {}, accessToken);
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/questions/:id', () => {
    it('should update a question set', async () => {
      const createRes = await authenticatedRequest('/questions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Update Test',
          questions: [{ question: 'Original?' }],
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/questions/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name',
          questions: [{ question: 'Updated?' }],
        }),
      }, accessToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.name).toBe('Updated Name');
      expect(data.questions[0].question).toBe('Updated?');
    });
  });

  describe('DELETE /api/questions/:id', () => {
    it('should delete a question set', async () => {
      const createRes = await authenticatedRequest('/questions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Delete Test',
          questions: [{ question: 'Delete me?' }],
        }),
      }, accessToken);
      const created = await createRes.json();

      const response = await authenticatedRequest(`/questions/${created.id}`, {
        method: 'DELETE',
      }, accessToken);

      expect(response.status).toBe(200);

      // Verify it's deleted
      const getRes = await authenticatedRequest(`/questions/${created.id}`, {}, accessToken);
      expect(getRes.status).toBe(404);
    });
  });
});
