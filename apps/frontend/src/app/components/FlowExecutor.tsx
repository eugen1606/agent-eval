import React from 'react';
import { useAppContext } from '../context/AppContext';
import { AgentEvalClient } from '@agent-eval/api-client';

const apiClient = new AgentEvalClient();

export function FlowExecutor() {
  const { state, setResults, setLoading, setError } = useAppContext();

  const isConfigValid = () => {
    return (
      state.config.accessToken.trim() !== '' &&
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

    try {
      const response = await apiClient.executeFlow(state.config, state.questions);

      if (response.success && response.data) {
        setResults(response.data.results);
      } else {
        setError(response.error || 'Failed to execute flow');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
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
          <span>Processing questions...</span>
        </div>
      )}
    </div>
  );
}
