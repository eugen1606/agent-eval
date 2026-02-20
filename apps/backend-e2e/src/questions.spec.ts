import { authenticatedRequest, createTestUser, deleteTestUser } from './support/test-setup';
import { createQuestionSet } from './support/factories';
import {
  NON_EXISTENT_UUID,
  expectNotFound,
  expectPaginatedList,
  expectValidationError,
  expectDeleteAndVerify,
} from './support/assertions';

describe('Question Sets CRUD', () => {
  let accessToken: string;
  let csrfToken: string;

  beforeAll(async () => {
    const auth = await createTestUser('-questions');
    accessToken = auth.accessToken;
    csrfToken = auth.csrfToken;
  });

  afterAll(async () => {
    await deleteTestUser(accessToken, csrfToken);
  });

  describe('POST /api/questions', () => {
    it('should create a question set', async () => {
      const data = await createQuestionSet(accessToken, {
        description: 'A test question set',
      });

      expect(data.name).toBe('Test Question Set');
      expect(data.questions).toHaveLength(2);
    });
  });

  describe('GET /api/questions', () => {
    it('should list question sets', async () => {
      await createQuestionSet(accessToken, {
        name: 'List Test',
        questions: [{ question: 'Test?' }],
      });

      const response = await authenticatedRequest('/questions', {}, accessToken);
      await expectPaginatedList(response, { minLength: 1 });
    });
  });

  describe('GET /api/questions/:id', () => {
    it('should get a single question set', async () => {
      const created = await createQuestionSet(accessToken, {
        name: 'Get Test',
        questions: [{ question: 'Test?' }],
      });

      const response = await authenticatedRequest(`/questions/${created.id}`, {}, accessToken);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(created.id);
      expect(data.name).toBe('Get Test');
    });

    it('should return 404 for non-existent question set', async () => {
      const response = await authenticatedRequest(`/questions/${NON_EXISTENT_UUID}`, {}, accessToken);
      expectNotFound(response);
    });
  });

  describe('PUT /api/questions/:id', () => {
    it('should update a question set', async () => {
      const created = await createQuestionSet(accessToken, {
        name: 'Update Test',
        questions: [{ question: 'Original?' }],
      });

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
      const created = await createQuestionSet(accessToken, {
        name: 'Delete Test',
        questions: [{ question: 'Delete me?' }],
      });

      await expectDeleteAndVerify('/questions', created.id as string, accessToken);
    });
  });

  describe('inputVariables support', () => {
    it('should create a question set with inputVariables', async () => {
      const data = await createQuestionSet(accessToken, {
        name: 'With Input Variables',
        questions: [
          { question: 'Greet the user', inputVariables: { lang: 'en', user: { name: 'Alice' } } },
          { question: 'What is 2+2?', expectedAnswer: '4' },
        ],
      });

      expect(data.name).toBe('With Input Variables');
      expect(data.questions).toHaveLength(2);
      expect(data.questions[0].inputVariables).toEqual({ lang: 'en', user: { name: 'Alice' } });
      expect(data.questions[1].inputVariables).toBeUndefined();
    });

    it('should update a question set with inputVariables', async () => {
      const created = await createQuestionSet(accessToken, {
        name: 'Update Input Vars',
        questions: [{ question: 'Test?' }],
      });

      const response = await authenticatedRequest(`/questions/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Input Vars',
          questions: [{ question: 'Test?', inputVariables: { key: 'value' } }],
        }),
      }, accessToken);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.questions[0].inputVariables).toEqual({ key: 'value' });
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

      await expectValidationError(response, /[Nn]ame/);
    });

    it('should reject non-array questions', async () => {
      const response = await authenticatedRequest('/questions/import', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Invalid Import',
          questions: { question: 'Not an array' },
        }),
      }, accessToken);

      await expectValidationError(response, /[Qq]uestions/);
    });

    it('should reject empty questions array', async () => {
      const response = await authenticatedRequest('/questions/import', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Empty Import',
          questions: [],
        }),
      }, accessToken);

      await expectValidationError(response, 'Questions array cannot be empty');
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

    it('should import questions with inputVariables', async () => {
      const response = await authenticatedRequest('/questions/import', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Imported With Vars',
          questions: [
            { question: 'Hello?', inputVariables: { lang: 'fr' } },
            { question: 'Bye?' },
          ],
        }),
      }, accessToken);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.questions[0].inputVariables).toEqual({ lang: 'fr' });
      expect(data.questions[1].inputVariables).toBeUndefined();
    });

    it('should reject non-object inputVariables on import', async () => {
      const response = await authenticatedRequest('/questions/import', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Invalid Vars',
          questions: [{ question: 'Test?', inputVariables: 'not-an-object' }],
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('inputVariables');
    });

    it('should reject array inputVariables on import', async () => {
      const response = await authenticatedRequest('/questions/import', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Array Vars',
          questions: [{ question: 'Test?', inputVariables: [1, 2, 3] }],
        }),
      }, accessToken);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('inputVariables');
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
