import {
  FlowConfig,
  QuestionInput,
  ExecuteFlowResponse,
  EvaluationSession,
  LLMJudgeResponse,
  ApiResponse,
  StoredAccessToken,
  CreateAccessTokenRequest,
  StoredQuestionSet,
  CreateQuestionSetRequest,
  StoredFlowConfig,
  CreateFlowConfigRequest,
  StoredEvaluation,
  CreateEvaluationRequest,
} from '@agent-eval/shared';

const DEFAULT_API_URL = 'http://localhost:3001/api';

export class AgentEvalClient {
  private apiUrl: string;

  constructor(apiUrl: string = DEFAULT_API_URL) {
    this.apiUrl = apiUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.apiUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

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

  // Flow Execution
  async executeFlow(
    config: FlowConfig,
    questions: QuestionInput[]
  ): Promise<ApiResponse<ExecuteFlowResponse>> {
    return this.request<ExecuteFlowResponse>('/flow/execute', {
      method: 'POST',
      body: JSON.stringify({ config, questions }),
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

  // Sessions (file-based)
  async saveSession(
    flowName: string,
    session: EvaluationSession
  ): Promise<ApiResponse<{ id: string }>> {
    return this.request<{ id: string }>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ flowName, session }),
    });
  }

  async getSessions(): Promise<ApiResponse<EvaluationSession[]>> {
    return this.request<EvaluationSession[]>('/sessions');
  }

  async getSession(id: string): Promise<ApiResponse<EvaluationSession>> {
    return this.request<EvaluationSession>(`/sessions/${id}`);
  }

  async deleteSession(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/sessions/${id}`, { method: 'DELETE' });
  }

  async exportSession(
    sessionId: string,
    format: 'json' | 'csv'
  ): Promise<ApiResponse<string>> {
    return this.request<string>(`/sessions/${sessionId}/export?format=${format}`);
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

  // Evaluations (database)
  async createEvaluation(
    data: CreateEvaluationRequest
  ): Promise<ApiResponse<StoredEvaluation>> {
    return this.request<StoredEvaluation>('/evaluations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getEvaluations(): Promise<ApiResponse<StoredEvaluation[]>> {
    return this.request<StoredEvaluation[]>('/evaluations');
  }

  async getEvaluation(id: string): Promise<ApiResponse<StoredEvaluation>> {
    return this.request<StoredEvaluation>(`/evaluations/${id}`);
  }

  async updateEvaluation(
    id: string,
    data: Partial<CreateEvaluationRequest>
  ): Promise<ApiResponse<StoredEvaluation>> {
    return this.request<StoredEvaluation>(`/evaluations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEvaluation(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/evaluations/${id}`, { method: 'DELETE' });
  }
}

export const createClient = (apiUrl?: string) => new AgentEvalClient(apiUrl);
