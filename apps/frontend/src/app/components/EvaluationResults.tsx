import React from 'react';
import { useAppContext } from '../context/AppContext';
import { AgentEvalClient } from '@agent-eval/api-client';

const apiClient = new AgentEvalClient();

export function EvaluationResults() {
  const { state, updateResult, setLoading } = useAppContext();

  const handleHumanEvaluation = (id: string, isCorrect: boolean) => {
    updateResult(id, { humanEvaluation: isCorrect, isCorrect });
  };

  const handleLLMEvaluation = async (id: string) => {
    const result = state.results.find((r) => r.id === id);
    if (!result) return;

    setLoading(true);
    try {
      const response = await apiClient.evaluateWithLLM(
        result.question,
        result.answer,
        result.expectedAnswer
      );

      if (response.success && response.data) {
        updateResult(id, {
          llmJudgeScore: response.data.score,
          llmJudgeReasoning: response.data.reasoning,
          isCorrect: response.data.isCorrect,
        });
      }
    } catch (error) {
      console.error('LLM evaluation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluateAll = async () => {
    setLoading(true);
    for (const result of state.results) {
      if (!result.llmJudgeScore) {
        await handleLLMEvaluation(result.id);
      }
    }
    setLoading(false);
  };

  if (state.results.length === 0) {
    return (
      <div className="evaluation-results empty">
        <p>No results yet. Execute a flow to see results here.</p>
      </div>
    );
  }

  return (
    <div className="evaluation-results">
      <div className="results-header">
        <h2>Evaluation Results</h2>
        <button onClick={handleEvaluateAll} disabled={state.isLoading}>
          {state.isLoading ? 'Evaluating...' : 'Evaluate All with LLM'}
        </button>
      </div>

      <div className="results-list">
        {state.results.map((result) => (
          <div key={result.id} className="result-card">
            <div className="result-question">
              <strong>Question:</strong> {result.question}
            </div>

            <div className="result-answer">
              <strong>Answer:</strong> {result.answer}
            </div>

            {result.expectedAnswer && (
              <div className="result-expected">
                <strong>Expected:</strong> {result.expectedAnswer}
              </div>
            )}

            {result.llmJudgeScore !== undefined && (
              <div className="result-llm-evaluation">
                <strong>LLM Score:</strong> {result.llmJudgeScore}/100
                {result.llmJudgeReasoning && (
                  <div className="llm-reasoning">
                    <em>{result.llmJudgeReasoning}</em>
                  </div>
                )}
              </div>
            )}

            <div className="result-actions">
              <span>Human Evaluation:</span>
              <button
                className={`eval-btn ${result.humanEvaluation === true ? 'active correct' : ''}`}
                onClick={() => handleHumanEvaluation(result.id, true)}
              >
                Correct
              </button>
              <button
                className={`eval-btn ${result.humanEvaluation === false ? 'active incorrect' : ''}`}
                onClick={() => handleHumanEvaluation(result.id, false)}
              >
                Incorrect
              </button>
              <button
                className="eval-btn llm"
                onClick={() => handleLLMEvaluation(result.id)}
                disabled={state.isLoading}
              >
                LLM Judge
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
