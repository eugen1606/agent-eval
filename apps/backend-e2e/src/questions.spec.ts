import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';

describe('Question Sets CRUD', () => {
  let accessToken: string;

  beforeAll(async () => {
    const auth = await createTestUser('-questions');
    accessToken = auth.accessToken;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken);
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

  describe('POST /api/questions/import', () => {
    it('should import valid questions array', async () => {
      const response = await authenticatedRequest('/questions/import', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Imported Set',
          description: 'Imported via API',
          questions: [
            { question: 'What is 2+2?', expectedAnswer: '4' },
            { question: 'Capital of France?' },
          ],
        }),
      }, accessToken);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Imported Set');
      expect(data.description).toBe('Imported via API');
      expect(data.questions).toHaveLength(2);
      expect(data.questions[0].question).toBe('What is 2+2?');
      expect(data.questions[0].expectedAnswer).toBe('4');
      expect(data.questions[1].question).toBe('Capital of France?');
    });

    it('should reject empty name', async () => {
      const response = await authenticatedRequest('/questions/import', {
        method: 'POST',
        body: JSON.stringify({
          name: '',
          questions: [{ question: 'Test?' }],
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('Name is required');
    });

    it('should reject non-array questions', async () => {
      const response = await authenticatedRequest('/questions/import', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Invalid Import',
          questions: { question: 'Not an array' },
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('Questions must be an array');
    });

    it('should reject empty questions array', async () => {
      const response = await authenticatedRequest('/questions/import', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Empty Import',
          questions: [],
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('Questions array cannot be empty');
    });

    it('should reject question without question property', async () => {
      const response = await authenticatedRequest('/questions/import', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Invalid Question',
          questions: [{ answer: 'No question here' }],
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('index 0');
      expect(data.message).toContain('"question"');
    });

    it('should reject question with non-string expectedAnswer', async () => {
      const response = await authenticatedRequest('/questions/import', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Invalid Expected Answer',
          questions: [{ question: 'What is 2+2?', expectedAnswer: 4 }],
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('expectedAnswer');
      expect(data.message).toContain('string');
    });

    it('should trim whitespace from name', async () => {
      const response = await authenticatedRequest('/questions/import', {
        method: 'POST',
        body: JSON.stringify({
          name: '  Trimmed Name  ',
          questions: [{ question: 'Test?' }],
        }),
      }, accessToken);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.name).toBe('Trimmed Name');
    });
  });
});
