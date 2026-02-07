import { authenticatedRequest } from '../test-setup';

export const NON_EXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

export async function expectCreated(
  response: Response,
  expectedFields?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  expect(response.status).toBe(201);
  const data = await response.json();
  expect(data.id).toBeDefined();

  if (expectedFields) {
    for (const [key, value] of Object.entries(expectedFields)) {
      expect(data[key]).toEqual(value);
    }
  }

  return data;
}

export async function expectPaginatedList(
  response: Response,
  opts?: { minLength?: number },
): Promise<{ data: Record<string, unknown>[]; pagination: Record<string, unknown> }> {
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.data).toBeDefined();
  expect(Array.isArray(result.data)).toBe(true);
  expect(result.pagination).toBeDefined();

  if (opts?.minLength !== undefined) {
    expect(result.data.length).toBeGreaterThanOrEqual(opts.minLength);
  }

  return result;
}

export function expectNotFound(response: Response): void {
  expect(response.status).toBe(404);
}

export async function expectValidationError(
  response: Response,
  messagePattern?: RegExp | string,
): Promise<void> {
  expect(response.status).toBe(400);

  if (messagePattern) {
    const data = await response.json();
    if (typeof messagePattern === 'string') {
      expect(data.message).toContain(messagePattern);
    } else {
      expect(data.message).toMatch(messagePattern);
    }
  }
}

export async function expectConflict(
  response: Response,
  messagePattern?: RegExp | string,
): Promise<void> {
  expect(response.status).toBe(409);

  if (messagePattern) {
    const data = await response.json();
    if (typeof messagePattern === 'string') {
      expect(data.message).toContain(messagePattern);
    } else {
      expect(data.message).toMatch(messagePattern);
    }
  }
}

export async function expectDeleteAndVerify(
  endpoint: string,
  id: string,
  accessToken: string,
): Promise<void> {
  const deleteRes = await authenticatedRequest(
    `${endpoint}/${id}`,
    { method: 'DELETE' },
    accessToken,
  );
  expect(deleteRes.status).toBe(200);

  const getRes = await authenticatedRequest(
    `${endpoint}/${id}`,
    {},
    accessToken,
  );
  expect(getRes.status).toBe(404);
}
