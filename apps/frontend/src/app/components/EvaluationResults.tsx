import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { AgentEvalClient } from '@agent-eval/api-client';
import { HumanEvaluationStatus } from '@agent-eval/shared';

const apiClient = new AgentEvalClient();

export function EvaluationResults() {
  const { state, updateResult, setLoading } = useAppContext();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [evaluationName, setEvaluationName] = useState('');
  const [evaluationDescription, setEvaluationDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleHumanEvaluation = (id: string, status: HumanEvaluationStatus) => {
    const isCorrect = status === 'correct' ? true : status === 'incorrect' ? false : undefined;
    updateResult(id, { humanEvaluation: status, isCorrect });
  };

  const handleDescriptionChange = (id: string, description: string) => {
    updateResult(id, { humanEvaluationDescription: description });
  };

  // LLM evaluation functions kept for future implementation
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleEvaluateAll = async () => {
    setLoading(true);
    for (const result of state.results) {
      if (!result.llmJudgeScore) {
        await handleLLMEvaluation(result.id);
      }
    }
    setLoading(false);
  };

  const handleSaveEvaluation = async () => {
    if (!evaluationName.trim()) return;

    setSaving(true);
    const response = await apiClient.createEvaluation({
      name: evaluationName,
      finalOutput: {
        config: state.config,
        results: state.results,
        savedAt: new Date().toISOString(),
      },
      flowId: state.config.flowId || undefined,
      description: evaluationDescription || undefined,
    });

    if (response.success) {
      setShowSaveDialog(false);
      setEvaluationName('');
      setEvaluationDescription('');
    }
    setSaving(false);
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
        <button onClick={() => setShowSaveDialog(true)}>Save as Evaluation</button>
      </div>

      {showSaveDialog && (
        <div className="save-dialog">
          <input
            type="text"
            placeholder="Evaluation name"
            value={evaluationName}
            onChange={(e) => setEvaluationName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={evaluationDescription}
            onChange={(e) => setEvaluationDescription(e.target.value)}
          />
          <button onClick={handleSaveEvaluation} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => setShowSaveDialog(false)}>Cancel</button>
        </div>
      )}

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

            <div className="result-actions">
              <span>Human Evaluation:</span>
              <button
                className={`eval-btn ${result.humanEvaluation === 'correct' ? 'active correct' : ''}`}
                onClick={() => handleHumanEvaluation(result.id, 'correct')}
              >
                Correct
              </button>
              <button
                className={`eval-btn ${result.humanEvaluation === 'partial' ? 'active partial' : ''}`}
                onClick={() => handleHumanEvaluation(result.id, 'partial')}
              >
                Partial
              </button>
              <button
                className={`eval-btn ${result.humanEvaluation === 'incorrect' ? 'active incorrect' : ''}`}
                onClick={() => handleHumanEvaluation(result.id, 'incorrect')}
              >
                Incorrect
              </button>
            </div>

            <div className="result-description">
              <input
                type="text"
                placeholder="Add evaluation notes (optional)"
                value={result.humanEvaluationDescription || ''}
                onChange={(e) => handleDescriptionChange(result.id, e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
