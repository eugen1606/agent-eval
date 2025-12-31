import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { EvaluationResult } from '@agent-eval/shared';

const API_URL = 'http://localhost:3001/api';

export function FlowExecutor() {
  const { state, addResult, clearResults, setLoading, setError } = useAppContext();
  const [processedCount, setProcessedCount] = useState(0);

  const isConfigValid = () => {
    const hasAccessToken = state.config.accessToken.trim() !== '' || !!state.config.accessTokenId;
    return (
      hasAccessToken &&
      state.config.basePath.trim() !== '' &&
      state.config.flowId.trim() !== '' &&
      state.questions.length > 0
    );
  };

  const handleExecute = async () => {
    if (!isConfigValid()) {
      setError('Please fill in all configuration fields and add at least one question');
      return;
    }

    setLoading(true);
    setError(null);
    clearResults();
    setProcessedCount(0);

    try {
      // Get auth token from localStorage
      const authTokens = localStorage.getItem('auth_tokens');
      const accessToken = authTokens ? JSON.parse(authTokens).accessToken : null;

      if (!accessToken) {
        setError('Not authenticated. Please login again.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/flow/execute-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          config: state.config,
          questions: state.questions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'result') {
                const result: EvaluationResult = data.result;
                addResult(result);
                setProcessedCount((prev) => prev + 1);
              } else if (data.type === 'error') {
                setError(data.error);
              } else if (data.type === 'complete') {
                // Stream complete
              }
            } catch (e) {
              // Ignore parse errors for incomplete data
            }
          }
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
      setProcessedCount(0);
    }
  };

  return (
    <div className="flow-executor">
      <button
        className="execute-btn"
        onClick={handleExecute}
        disabled={!isConfigValid() || state.isLoading}
      >
        {state.isLoading ? 'Executing...' : 'Execute Flow'}
      </button>

      {state.error && <div className="error-message">{state.error}</div>}

      {state.isLoading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>
            Processing questions... ({processedCount}/{state.questions.length})
          </span>
        </div>
      )}
    </div>
  );
}
