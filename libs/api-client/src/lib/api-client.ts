import {
  LLMJudgeResponse,
  ApiResponse,
  StoredAccessToken,
  CreateAccessTokenRequest,
  StoredQuestionSet,
  CreateQuestionSetRequest,
  StoredFlowConfig,
  CreateFlowConfigRequest,
  StoredScheduledTest,
  CreateScheduledTestRequest,
  User,
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RefreshTokenRequest,
  ChangePasswordRequest,
  AccountStats,
  StoredWebhook,
  CreateWebhookRequest,
  WebhookEvent,
  StoredTest,
  CreateTestRequest,
  StoredRun,
  CreateRunRequest,
  UpdateRunRequest,
  UpdateResultEvaluationRequest,
  RunStats,
  PaginatedResponse,
  TestsFilterParams,
  RunsFilterParams,
  ScheduledTestsFilterParams,
} from '@agent-eval/shared';

const DEFAULT_API_URL = 'http://localhost:3001/api';
const TOKEN_STORAGE_KEY = 'auth_tokens';

export class AgentEvalClient {
  private apiUrl: string;
  private onAuthChange?: (isAuthenticated: boolean) => void;

  constructor(apiUrl: string = DEFAULT_API_URL) {
    this.apiUrl = apiUrl;
  }

  // Token Management - always read fresh from localStorage
  private getTokens(): AuthTokens | null {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  private saveTokens(tokens: AuthTokens | null): void {
    if (typeof window !== 'undefined') {
      if (tokens) {
        localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
    this.onAuthChange?.(!!tokens);
  }

  public setOnAuthChange(callback: (isAuthenticated: boolean) => void): void {
    this.onAuthChange = callback;
  }

  public isAuthenticated(): boolean {
    return !!this.getTokens()?.accessToken;
  }

  public getAuthToken(): string | null {
    return this.getTokens()?.accessToken || null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth = true
  ): Promise<ApiResponse<T>> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };

      const tokens = this.getTokens();
      if (requireAuth && tokens?.accessToken) {
        headers['Authorization'] = `Bearer ${tokens.accessToken}`;
      }

      const response = await fetch(`${this.apiUrl}${endpoint}`, {
        ...options,
        headers,
      });

      // Handle 401 - try to refresh token
      if (response.status === 401 && requireAuth && tokens?.refreshToken) {
        const refreshed = await this.refreshTokens();
        if (refreshed) {
          // Retry the original request with new token
          const newTokens = this.getTokens();
          headers['Authorization'] = `Bearer ${newTokens?.accessToken}`;
          const retryResponse = await fetch(`${this.apiUrl}${endpoint}`, {
            ...options,
            headers,
          });

          if (!retryResponse.ok) {
            const data = await retryResponse.json();
            return { success: false, error: data.message || 'Request failed' };
          }

          const data = await retryResponse.json();
          return { success: true, data };
        } else {
          // Refresh failed, clear tokens
          this.saveTokens(null);
          return { success: false, error: 'Session expired. Please login again.' };
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.message || 'Request failed' };
      }

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Auth Methods
  async login(credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    const result = await this.request<AuthResponse>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      },
      false
    );

    if (result.success && result.data) {
      this.saveTokens(result.data.tokens);
    }

    return result;
  }

  async register(data: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
    const result = await this.request<AuthResponse>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      false
    );

    if (result.success && result.data) {
      this.saveTokens(result.data.tokens);
    }

    return result;
  }

  private async refreshTokens(): Promise<boolean> {
    const tokens = this.getTokens();
    if (!tokens?.refreshToken) return false;

    try {
      const response = await fetch(`${this.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken } as RefreshTokenRequest),
      });

      if (!response.ok) return false;

      const data: AuthTokens = await response.json();
      this.saveTokens(data);
      return true;
    } catch {
      return false;
    }
  }

  async getMe(): Promise<ApiResponse<User>> {
    return this.request<User>('/auth/me');
  }

  logout(): void {
    this.saveTokens(null);
  }

  // Account Management
  async getAccountStats(): Promise<ApiResponse<AccountStats>> {
    return this.request<AccountStats>('/auth/account/stats');
  }

  async changePassword(data: ChangePasswordRequest): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>('/auth/account/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteAccount(): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>('/auth/account', {
      method: 'DELETE',
    });
  }

  // LLM Evaluation
  async evaluateWithLLM(
    question: string,
    answer: string,
    expectedAnswer?: string
  ): Promise<ApiResponse<LLMJudgeResponse>> {
    return this.request<LLMJudgeResponse>('/evaluate/llm-judge', {
      method: 'POST',
      body: JSON.stringify({ question, answer, expectedAnswer }),
    });
  }

  // Access Tokens
  async createAccessToken(
    data: CreateAccessTokenRequest
  ): Promise<ApiResponse<StoredAccessToken>> {
    return this.request<StoredAccessToken>('/access-tokens', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAccessTokens(): Promise<ApiResponse<StoredAccessToken[]>> {
    return this.request<StoredAccessToken[]>('/access-tokens');
  }

  async getAccessToken(id: string): Promise<ApiResponse<StoredAccessToken>> {
    return this.request<StoredAccessToken>(`/access-tokens/${id}`);
  }

  async updateAccessToken(
    id: string,
    data: Partial<CreateAccessTokenRequest>
  ): Promise<ApiResponse<StoredAccessToken>> {
    return this.request<StoredAccessToken>(`/access-tokens/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAccessToken(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/access-tokens/${id}`, { method: 'DELETE' });
  }

  // Question Sets
  async createQuestionSet(
    data: CreateQuestionSetRequest
  ): Promise<ApiResponse<StoredQuestionSet>> {
    return this.request<StoredQuestionSet>('/questions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getQuestionSets(): Promise<ApiResponse<StoredQuestionSet[]>> {
    return this.request<StoredQuestionSet[]>('/questions');
  }

  async getQuestionSet(id: string): Promise<ApiResponse<StoredQuestionSet>> {
    return this.request<StoredQuestionSet>(`/questions/${id}`);
  }

  async updateQuestionSet(
    id: string,
    data: Partial<CreateQuestionSetRequest>
  ): Promise<ApiResponse<StoredQuestionSet>> {
    return this.request<StoredQuestionSet>(`/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteQuestionSet(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/questions/${id}`, { method: 'DELETE' });
  }

  async importQuestionSet(data: {
    name: string;
    description?: string;
    questions: unknown;
  }): Promise<ApiResponse<StoredQuestionSet>> {
    return this.request<StoredQuestionSet>('/questions/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Flow Configs
  async createFlowConfig(
    data: CreateFlowConfigRequest
  ): Promise<ApiResponse<StoredFlowConfig>> {
    return this.request<StoredFlowConfig>('/flow-configs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getFlowConfigs(): Promise<ApiResponse<StoredFlowConfig[]>> {
    return this.request<StoredFlowConfig[]>('/flow-configs');
  }

  async getFlowConfig(id: string): Promise<ApiResponse<StoredFlowConfig>> {
    return this.request<StoredFlowConfig>(`/flow-configs/${id}`);
  }

  async updateFlowConfig(
    id: string,
    data: Partial<CreateFlowConfigRequest>
  ): Promise<ApiResponse<StoredFlowConfig>> {
    return this.request<StoredFlowConfig>(`/flow-configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFlowConfig(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/flow-configs/${id}`, { method: 'DELETE' });
  }

  // Scheduled Tests
  async createScheduledTest(
    data: CreateScheduledTestRequest
  ): Promise<ApiResponse<StoredScheduledTest>> {
    return this.request<StoredScheduledTest>('/scheduled-tests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getScheduledTests(filters?: ScheduledTestsFilterParams): Promise<ApiResponse<PaginatedResponse<StoredScheduledTest>>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.testId) params.append('testId', filters.testId);
    if (filters?.status) params.append('status', filters.status);
    const query = params.toString();
    return this.request<PaginatedResponse<StoredScheduledTest>>(`/scheduled-tests${query ? `?${query}` : ''}`);
  }

  async getScheduledTest(id: string): Promise<ApiResponse<StoredScheduledTest>> {
    return this.request<StoredScheduledTest>(`/scheduled-tests/${id}`);
  }

  async updateScheduledTest(
    id: string,
    data: Partial<CreateScheduledTestRequest>
  ): Promise<ApiResponse<StoredScheduledTest>> {
    return this.request<StoredScheduledTest>(`/scheduled-tests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteScheduledTest(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/scheduled-tests/${id}`, { method: 'DELETE' });
  }

  async resetScheduledTest(
    id: string,
    scheduledAt?: string
  ): Promise<ApiResponse<StoredScheduledTest>> {
    return this.request<StoredScheduledTest>(`/scheduled-tests/${id}/reset`, {
      method: 'POST',
      body: JSON.stringify({ scheduledAt }),
    });
  }

  async executeScheduledTestNow(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/scheduled-tests/${id}/execute`, {
      method: 'POST',
    });
  }

  // Webhooks
  async createWebhook(data: CreateWebhookRequest): Promise<ApiResponse<StoredWebhook>> {
    return this.request<StoredWebhook>('/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getWebhooks(): Promise<ApiResponse<StoredWebhook[]>> {
    return this.request<StoredWebhook[]>('/webhooks');
  }

  async getWebhook(id: string): Promise<ApiResponse<StoredWebhook>> {
    return this.request<StoredWebhook>(`/webhooks/${id}`);
  }

  async updateWebhook(id: string, data: Partial<CreateWebhookRequest>): Promise<ApiResponse<StoredWebhook>> {
    return this.request<StoredWebhook>(`/webhooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteWebhook(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/webhooks/${id}`, { method: 'DELETE' });
  }

  async toggleWebhook(id: string): Promise<ApiResponse<StoredWebhook>> {
    return this.request<StoredWebhook>(`/webhooks/${id}/toggle`, {
      method: 'POST',
    });
  }

  async testWebhook(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request<{ success: boolean; message: string }>(`/webhooks/${id}/test`, {
      method: 'POST',
    });
  }

  async getWebhookEvents(): Promise<ApiResponse<{ events: WebhookEvent[] }>> {
    return this.request<{ events: WebhookEvent[] }>('/webhooks/events');
  }

  // Tests
  async createTest(data: CreateTestRequest): Promise<ApiResponse<StoredTest>> {
    return this.request<StoredTest>('/tests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTests(filters?: TestsFilterParams): Promise<ApiResponse<PaginatedResponse<StoredTest>>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.questionSetId) params.append('questionSetId', filters.questionSetId);
    if (filters?.multiStep !== undefined) params.append('multiStep', filters.multiStep.toString());
    if (filters?.flowId) params.append('flowId', filters.flowId);
    const query = params.toString();
    return this.request<PaginatedResponse<StoredTest>>(`/tests${query ? `?${query}` : ''}`);
  }

  async getTest(id: string): Promise<ApiResponse<StoredTest>> {
    return this.request<StoredTest>(`/tests/${id}`);
  }

  async updateTest(id: string, data: Partial<CreateTestRequest>): Promise<ApiResponse<StoredTest>> {
    return this.request<StoredTest>(`/tests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTest(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/tests/${id}`, { method: 'DELETE' });
  }

  async runTest(testId: string): Promise<ApiResponse<StoredRun>> {
    return this.request<StoredRun>(`/tests/${testId}/run`, {
      method: 'POST',
    });
  }

  // Runs
  async createRun(data: CreateRunRequest): Promise<ApiResponse<StoredRun>> {
    return this.request<StoredRun>('/runs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getRuns(filters?: RunsFilterParams): Promise<ApiResponse<PaginatedResponse<StoredRun>>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.testId) params.append('testId', filters.testId);
    const query = params.toString();
    return this.request<PaginatedResponse<StoredRun>>(`/runs${query ? `?${query}` : ''}`);
  }

  async getRun(id: string): Promise<ApiResponse<StoredRun>> {
    return this.request<StoredRun>(`/runs/${id}`);
  }

  async updateRun(id: string, data: UpdateRunRequest): Promise<ApiResponse<StoredRun>> {
    return this.request<StoredRun>(`/runs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async cancelRun(id: string): Promise<ApiResponse<StoredRun>> {
    return this.request<StoredRun>(`/runs/${id}/cancel`, { method: 'POST' });
  }

  async getRunStats(id: string): Promise<ApiResponse<RunStats>> {
    return this.request<RunStats>(`/runs/${id}/stats`);
  }

  async updateResultEvaluation(
    runId: string,
    resultId: string,
    data: Omit<UpdateResultEvaluationRequest, 'resultId'>
  ): Promise<ApiResponse<StoredRun>> {
    return this.request<StoredRun>(`/runs/${runId}/results/${resultId}/evaluation`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async bulkUpdateResultEvaluations(
    runId: string,
    updates: UpdateResultEvaluationRequest[]
  ): Promise<ApiResponse<StoredRun>> {
    return this.request<StoredRun>(`/runs/${runId}/results/evaluations`, {
      method: 'PUT',
      body: JSON.stringify({ updates }),
    });
  }

  // Stream run execution (returns EventSource URL for SSE)
  getRunStreamUrl(runId: string): string {
    return `${this.apiUrl}/runs/${runId}/stream`;
  }
}

export const createClient = (apiUrl?: string) => new AgentEvalClient(apiUrl);
