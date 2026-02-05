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
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  ChangePasswordRequest,
  AccountStats,
  StoredWebhook,
  CreateWebhookRequest,
  WebhookEvent,
  WebhookVariableDefinition,
  StoredTag,
  CreateTagRequest,
  StoredTest,
  CreateTestRequest,
  StoredRun,
  CreateRunRequest,
  UpdateRunRequest,
  UpdateResultEvaluationRequest,
  RunStats,
  PerformanceStats,
  RunComparison,
  PaginatedResponse,
  TestsFilterParams,
  RunsFilterParams,
  ScheduledTestsFilterParams,
  AccessTokensFilterParams,
  QuestionSetsFilterParams,
  WebhooksFilterParams,
  FlowConfigsFilterParams,
  TagsFilterParams,
  ExportBundle,
  ExportOptions,
  ImportPreviewResult,
  ImportResult,
  ConflictStrategy,
} from '@agent-eval/shared';

const DEFAULT_API_URL = 'http://localhost:3001/api';
const CSRF_COOKIE_NAME = 'csrf_token';

/**
 * Cookie-based authentication API client.
 * Uses httpOnly cookies for JWT tokens and CSRF tokens for protection.
 */
export class AgentEvalClient {
  private apiUrl: string;
  private onAuthChange?: (isAuthenticated: boolean) => void;
  private csrfToken: string | null = null;
  // Mutex to prevent concurrent token refresh
  private refreshPromise: Promise<boolean> | null = null;

  constructor(apiUrl: string = DEFAULT_API_URL) {
    this.apiUrl = apiUrl;
    // Load CSRF token from cookie on initialization
    this.loadCsrfTokenFromCookie();
  }

  /**
   * Load CSRF token from cookie (not httpOnly, readable by JS)
   */
  private loadCsrfTokenFromCookie(): void {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(
        new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`),
      );
      this.csrfToken = match ? match[1] : null;
    }
  }

  /**
   * Set CSRF token (received from login/register response)
   */
  private setCsrfToken(token: string | null): void {
    this.csrfToken = token;
  }

  public setOnAuthChange(callback: (isAuthenticated: boolean) => void): void {
    this.onAuthChange = callback;
  }

  /**
   * Check if user is authenticated by verifying CSRF token presence.
   * (JWT cookie is httpOnly and can't be checked directly)
   */
  public isAuthenticated(): boolean {
    this.loadCsrfTokenFromCookie();
    return !!this.csrfToken;
  }

  /**
   * Get CSRF token for SSE endpoints that need it in header
   */
  public getAuthToken(): string | null {
    this.loadCsrfTokenFromCookie();
    return this.csrfToken;
  }

  /**
   * Get the API base URL for SSE/streaming endpoints
   */
  public getApiUrl(): string {
    return this.apiUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth = true,
  ): Promise<ApiResponse<T>> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };

      // Add CSRF token for state-changing requests
      const method = options.method?.toUpperCase() || 'GET';
      if (
        requireAuth &&
        this.csrfToken &&
        !['GET', 'HEAD', 'OPTIONS'].includes(method)
      ) {
        headers['X-CSRF-Token'] = this.csrfToken;
      }

      const response = await fetch(`${this.apiUrl}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include', // Include cookies in request
      });

      // Handle 401 - try to refresh token
      if (response.status === 401 && requireAuth) {
        const refreshed = await this.refreshTokens();
        if (refreshed) {
          // Update CSRF token after refresh
          this.loadCsrfTokenFromCookie();
          if (this.csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            headers['X-CSRF-Token'] = this.csrfToken;
          }

          const retryResponse = await fetch(`${this.apiUrl}${endpoint}`, {
            ...options,
            headers,
            credentials: 'include',
          });

          if (!retryResponse.ok) {
            const text = await retryResponse.text();
            const data = text ? JSON.parse(text) : {};
            return { success: false, error: data.message || 'Request failed' };
          }

          const retryText = await retryResponse.text();
          const retryData = retryText ? JSON.parse(retryText) : undefined;
          return { success: true, data: retryData };
        } else {
          // Refresh failed
          this.setCsrfToken(null);
          this.onAuthChange?.(false);
          return {
            success: false,
            error: 'Session expired. Please login again.',
          };
        }
      }

      // Handle empty response (204 No Content)
      const text = await response.text();
      const data = text ? JSON.parse(text) : undefined;

      if (!response.ok) {
        return { success: false, error: data?.message || 'Request failed' };
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
    const result = await this.request<AuthResponse & { csrfToken?: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      },
      false,
    );

    if (result.success && result.data) {
      // CSRF token is returned in body for initial setup
      if (result.data.csrfToken) {
        this.setCsrfToken(result.data.csrfToken);
      }
      this.onAuthChange?.(true);
    }

    return result;
  }

  async register(data: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
    const result = await this.request<AuthResponse & { csrfToken?: string }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      false,
    );

    if (result.success && result.data) {
      if (result.data.csrfToken) {
        this.setCsrfToken(result.data.csrfToken);
      }
      this.onAuthChange?.(true);
    }

    return result;
  }

  private async refreshTokens(): Promise<boolean> {
    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Start a new refresh and store the promise
    this.refreshPromise = this.doRefreshTokens();

    try {
      return await this.refreshPromise;
    } finally {
      // Clear the promise so future refreshes can proceed
      this.refreshPromise = null;
    }
  }

  private async doRefreshTokens(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) return false;

      const data = await response.json();
      if (data.csrfToken) {
        this.setCsrfToken(data.csrfToken);
      }
      return true;
    } catch {
      return false;
    }
  }

  async getMe(): Promise<ApiResponse<User>> {
    return this.request<User>('/auth/me');
  }

  async logout(): Promise<void> {
    try {
      // Call logout endpoint to clear cookies
      await fetch(`${this.apiUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore errors
    }
    this.setCsrfToken(null);
    this.onAuthChange?.(false);
  }

  // Account Management
  async getAccountStats(): Promise<ApiResponse<AccountStats>> {
    return this.request<AccountStats>('/auth/account/stats');
  }

  async changePassword(
    data: ChangePasswordRequest,
  ): Promise<ApiResponse<{ message: string }>> {
    const result = await this.request<{ message: string }>(
      '/auth/account/change-password',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );

    // Password change clears cookies, user needs to re-login
    if (result.success) {
      this.setCsrfToken(null);
      this.onAuthChange?.(false);
    }

    return result;
  }

  async deleteAccount(): Promise<ApiResponse<{ message: string }>> {
    const result = await this.request<{ message: string }>('/auth/account', {
      method: 'DELETE',
    });

    if (result.success) {
      this.setCsrfToken(null);
      this.onAuthChange?.(false);
    }

    return result;
  }

  // LLM Evaluation
  async evaluateWithLLM(
    question: string,
    answer: string,
    expectedAnswer?: string,
  ): Promise<ApiResponse<LLMJudgeResponse>> {
    return this.request<LLMJudgeResponse>('/evaluate/llm-judge', {
      method: 'POST',
      body: JSON.stringify({ question, answer, expectedAnswer }),
    });
  }

  // Access Tokens
  async createAccessToken(
    data: CreateAccessTokenRequest,
  ): Promise<ApiResponse<StoredAccessToken>> {
    return this.request<StoredAccessToken>('/access-tokens', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAccessTokens(
    filters?: AccessTokensFilterParams,
  ): Promise<ApiResponse<PaginatedResponse<StoredAccessToken>>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortDirection)
      params.append('sortDirection', filters.sortDirection);
    const query = params.toString();
    return this.request<PaginatedResponse<StoredAccessToken>>(
      `/access-tokens${query ? `?${query}` : ''}`,
    );
  }

  async getAccessToken(id: string): Promise<ApiResponse<StoredAccessToken>> {
    return this.request<StoredAccessToken>(`/access-tokens/${id}`);
  }

  async updateAccessToken(
    id: string,
    data: Partial<CreateAccessTokenRequest>,
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
    data: CreateQuestionSetRequest,
  ): Promise<ApiResponse<StoredQuestionSet>> {
    return this.request<StoredQuestionSet>('/questions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getQuestionSets(
    filters?: QuestionSetsFilterParams,
  ): Promise<ApiResponse<PaginatedResponse<StoredQuestionSet>>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortDirection)
      params.append('sortDirection', filters.sortDirection);
    const query = params.toString();
    return this.request<PaginatedResponse<StoredQuestionSet>>(
      `/questions${query ? `?${query}` : ''}`,
    );
  }

  async getQuestionSet(id: string): Promise<ApiResponse<StoredQuestionSet>> {
    return this.request<StoredQuestionSet>(`/questions/${id}`);
  }

  async updateQuestionSet(
    id: string,
    data: Partial<CreateQuestionSetRequest>,
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
    data: CreateFlowConfigRequest,
  ): Promise<ApiResponse<StoredFlowConfig>> {
    return this.request<StoredFlowConfig>('/flow-configs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getFlowConfigs(
    filters?: FlowConfigsFilterParams,
  ): Promise<ApiResponse<PaginatedResponse<StoredFlowConfig>>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortDirection)
      params.append('sortDirection', filters.sortDirection);
    const query = params.toString();
    return this.request<PaginatedResponse<StoredFlowConfig>>(
      `/flow-configs${query ? `?${query}` : ''}`,
    );
  }

  async getFlowConfig(id: string): Promise<ApiResponse<StoredFlowConfig>> {
    return this.request<StoredFlowConfig>(`/flow-configs/${id}`);
  }

  async updateFlowConfig(
    id: string,
    data: Partial<CreateFlowConfigRequest>,
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
    data: CreateScheduledTestRequest,
  ): Promise<ApiResponse<StoredScheduledTest>> {
    return this.request<StoredScheduledTest>('/scheduled-tests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getScheduledTests(
    filters?: ScheduledTestsFilterParams,
  ): Promise<ApiResponse<PaginatedResponse<StoredScheduledTest>>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.testId) params.append('testId', filters.testId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortDirection)
      params.append('sortDirection', filters.sortDirection);
    const query = params.toString();
    return this.request<PaginatedResponse<StoredScheduledTest>>(
      `/scheduled-tests${query ? `?${query}` : ''}`,
    );
  }

  async getScheduledTest(
    id: string,
  ): Promise<ApiResponse<StoredScheduledTest>> {
    return this.request<StoredScheduledTest>(`/scheduled-tests/${id}`);
  }

  async updateScheduledTest(
    id: string,
    data: Partial<CreateScheduledTestRequest>,
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
    scheduledAt?: string,
  ): Promise<ApiResponse<StoredScheduledTest>> {
    return this.request<StoredScheduledTest>(`/scheduled-tests/${id}/reset`, {
      method: 'POST',
      body: JSON.stringify({ scheduledAt }),
    });
  }

  async executeScheduledTestNow(
    id: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/scheduled-tests/${id}/execute`, {
      method: 'POST',
    });
  }

  // Webhooks
  async createWebhook(
    data: CreateWebhookRequest,
  ): Promise<ApiResponse<StoredWebhook>> {
    return this.request<StoredWebhook>('/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getWebhooks(
    filters?: WebhooksFilterParams,
  ): Promise<ApiResponse<PaginatedResponse<StoredWebhook>>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.enabled !== undefined)
      params.append('enabled', filters.enabled.toString());
    if (filters?.event) params.append('event', filters.event);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortDirection)
      params.append('sortDirection', filters.sortDirection);
    const query = params.toString();
    return this.request<PaginatedResponse<StoredWebhook>>(
      `/webhooks${query ? `?${query}` : ''}`,
    );
  }

  async getWebhook(id: string): Promise<ApiResponse<StoredWebhook>> {
    return this.request<StoredWebhook>(`/webhooks/${id}`);
  }

  async updateWebhook(
    id: string,
    data: Partial<CreateWebhookRequest>,
  ): Promise<ApiResponse<StoredWebhook>> {
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

  async testWebhook(
    id: string,
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request<{ success: boolean; message: string }>(
      `/webhooks/${id}/test`,
      {
        method: 'POST',
      },
    );
  }

  async getWebhookEvents(): Promise<ApiResponse<{ events: WebhookEvent[] }>> {
    return this.request<{ events: WebhookEvent[] }>('/webhooks/events');
  }

  async getWebhookVariables(): Promise<
    ApiResponse<{ variables: WebhookVariableDefinition[] }>
  > {
    return this.request<{ variables: WebhookVariableDefinition[] }>(
      '/webhooks/variables',
    );
  }

  // Tags
  async createTag(data: CreateTagRequest): Promise<ApiResponse<StoredTag>> {
    return this.request<StoredTag>('/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTags(
    filters?: TagsFilterParams,
  ): Promise<ApiResponse<PaginatedResponse<StoredTag>>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortDirection)
      params.append('sortDirection', filters.sortDirection);
    const query = params.toString();
    return this.request<PaginatedResponse<StoredTag>>(
      `/tags${query ? `?${query}` : ''}`,
    );
  }

  async getTag(id: string): Promise<ApiResponse<StoredTag>> {
    return this.request<StoredTag>(`/tags/${id}`);
  }

  async updateTag(
    id: string,
    data: Partial<CreateTagRequest>,
  ): Promise<ApiResponse<StoredTag>> {
    return this.request<StoredTag>(`/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTag(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/tags/${id}`, { method: 'DELETE' });
  }

  async getTagUsage(
    id: string,
  ): Promise<ApiResponse<{ tests: { id: string; name: string }[] }>> {
    return this.request<{ tests: { id: string; name: string }[] }>(
      `/tags/${id}/usage`,
    );
  }

  // Tests
  async createTest(data: CreateTestRequest): Promise<ApiResponse<StoredTest>> {
    return this.request<StoredTest>('/tests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTests(
    filters?: TestsFilterParams,
  ): Promise<ApiResponse<PaginatedResponse<StoredTest>>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.questionSetId)
      params.append('questionSetId', filters.questionSetId);
    if (filters?.accessTokenId)
      params.append('accessTokenId', filters.accessTokenId);
    if (filters?.webhookId) params.append('webhookId', filters.webhookId);
    if (filters?.multiStep !== undefined)
      params.append('multiStep', filters.multiStep.toString());
    if (filters?.flowConfigId)
      params.append('flowConfigId', filters.flowConfigId);
    if (filters?.tagIds && filters.tagIds.length > 0)
      params.append('tagIds', filters.tagIds.join(','));
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortDirection)
      params.append('sortDirection', filters.sortDirection);
    const query = params.toString();
    return this.request<PaginatedResponse<StoredTest>>(
      `/tests${query ? `?${query}` : ''}`,
    );
  }

  async getTest(id: string): Promise<ApiResponse<StoredTest>> {
    return this.request<StoredTest>(`/tests/${id}`);
  }

  async updateTest(
    id: string,
    data: Partial<CreateTestRequest>,
  ): Promise<ApiResponse<StoredTest>> {
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

  async getRuns(
    filters?: RunsFilterParams,
  ): Promise<ApiResponse<PaginatedResponse<StoredRun>>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.testId) params.append('testId', filters.testId);
    if (filters?.runId) params.append('runId', filters.runId);
    if (filters?.questionSetId)
      params.append('questionSetId', filters.questionSetId);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortDirection)
      params.append('sortDirection', filters.sortDirection);
    const query = params.toString();
    return this.request<PaginatedResponse<StoredRun>>(
      `/runs${query ? `?${query}` : ''}`,
    );
  }

  async getRun(id: string): Promise<ApiResponse<StoredRun>> {
    return this.request<StoredRun>(`/runs/${id}`);
  }

  async updateRun(
    id: string,
    data: UpdateRunRequest,
  ): Promise<ApiResponse<StoredRun>> {
    return this.request<StoredRun>(`/runs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async cancelRun(id: string): Promise<ApiResponse<StoredRun>> {
    return this.request<StoredRun>(`/runs/${id}/cancel`, { method: 'POST' });
  }

  async deleteRun(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>(`/runs/${id}`, {
      method: 'DELETE',
    });
  }

  async getRunStats(id: string): Promise<ApiResponse<RunStats>> {
    return this.request<RunStats>(`/runs/${id}/stats`);
  }

  async getRunPerformance(id: string): Promise<ApiResponse<PerformanceStats>> {
    return this.request<PerformanceStats>(`/runs/${id}/performance`);
  }

  async compareRuns(
    runId: string,
    otherRunId: string,
  ): Promise<ApiResponse<RunComparison>> {
    return this.request<RunComparison>(`/runs/${runId}/compare/${otherRunId}`);
  }

  async updateResultEvaluation(
    runId: string,
    resultId: string,
    data: Omit<UpdateResultEvaluationRequest, 'resultId'>,
  ): Promise<ApiResponse<StoredRun>> {
    return this.request<StoredRun>(
      `/runs/${runId}/results/${resultId}/evaluation`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    );
  }

  async bulkUpdateResultEvaluations(
    runId: string,
    updates: UpdateResultEvaluationRequest[],
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

  // Export/Import
  async exportConfig(options: ExportOptions): Promise<ApiResponse<ExportBundle>> {
    const params = new URLSearchParams();
    options.types.forEach((t) => params.append('types', t));
    if (options.testIds)
      options.testIds.forEach((id) => params.append('testIds', id));
    if (options.questionSetIds)
      options.questionSetIds.forEach((id) => params.append('questionSetIds', id));
    if (options.flowConfigIds)
      options.flowConfigIds.forEach((id) => params.append('flowConfigIds', id));
    if (options.tagIds)
      options.tagIds.forEach((id) => params.append('tagIds', id));
    if (options.webhookIds)
      options.webhookIds.forEach((id) => params.append('webhookIds', id));
    if (options.runIds)
      options.runIds.forEach((id) => params.append('runIds', id));
    const query = params.toString();
    return this.request<ExportBundle>(`/export?${query}`);
  }

  async previewImport(bundle: ExportBundle): Promise<ApiResponse<ImportPreviewResult>> {
    return this.request<ImportPreviewResult>('/export/preview', {
      method: 'POST',
      body: JSON.stringify(bundle),
    });
  }

  async importConfig(
    bundle: ExportBundle,
    conflictStrategy: ConflictStrategy,
  ): Promise<ApiResponse<ImportResult>> {
    return this.request<ImportResult>('/export/import', {
      method: 'POST',
      body: JSON.stringify({
        bundle,
        options: { conflictStrategy },
      }),
    });
  }
}

export const createClient = (apiUrl?: string) => new AgentEvalClient(apiUrl);
