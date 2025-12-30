import {
  FlowConfig,
  QuestionInput,
  ExecuteFlowResponse,
  EvaluationSession,
  LLMJudgeResponse,
  ApiResponse,
} from '@agent-eval/shared';

const DEFAULT_API_URL = 'http://localhost:3000/api';

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

  async executeFlow(
    config: FlowConfig,
    questions: QuestionInput[]
  ): Promise<ApiResponse<ExecuteFlowResponse>> {
    return this.request<ExecuteFlowResponse>('/flow/execute', {
      method: 'POST',
      body: JSON.stringify({ config, questions }),
    });
  }

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

  async exportSession(
    sessionId: string,
    format: 'json' | 'csv'
  ): Promise<ApiResponse<string>> {
    return this.request<string>(`/sessions/${sessionId}/export?format=${format}`);
  }
}

export const createClient = (apiUrl?: string) => new AgentEvalClient(apiUrl);
