import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { AgentEvalClient } from '@agent-eval/api-client';
import { HumanEvaluationStatus, IncorrectSeverity } from '@agent-eval/shared';
import { Modal } from './Modal';

const apiClient = new AgentEvalClient();

export function EvaluationResults() {
  const { state, updateResult, setLoading } = useAppContext();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [evaluationName, setEvaluationName] = useState('');
  const [evaluationDescription, setEvaluationDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const resetSaveDialog = () => {
    setEvaluationName('');
    setEvaluationDescription('');
    setShowSaveDialog(false);
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === state.results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(state.results.map(r => r.id)));
    }
  };

  const bulkAssign = (status: HumanEvaluationStatus) => {
    const isCorrect = status === 'correct' ? true : status === 'incorrect' ? false : undefined;
    selectedIds.forEach(id => {
      updateResult(id, { humanEvaluation: status, isCorrect });
    });
    setSelectedIds(new Set());
  };

  const handleHumanEvaluation = (id: string, status: HumanEvaluationStatus) => {
    const isCorrect = status === 'correct' ? true : status === 'incorrect' ? false : undefined;
    updateResult(id, { humanEvaluation: status, isCorrect });
  };

  const handleDescriptionChange = (id: string, description: string) => {
    updateResult(id, { humanEvaluationDescription: description });
  };

  const handleSeverityChange = (id: string, severity: IncorrectSeverity) => {
    updateResult(id, { severity });
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
      resetSaveDialog();
    }
    setSaving(false);
  };

  const evaluatedCount = state.results.filter(
    r => r.humanEvaluation !== undefined
  ).length;

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
        <span className="evaluation-progress">
          {evaluatedCount}/{state.results.length} evaluated
        </span>
        <button onClick={() => setShowSaveDialog(true)}>Save as Evaluation</button>
      </div>

      <div className="bulk-actions">
        <label className="select-all">
          <input
            type="checkbox"
            checked={selectedIds.size === state.results.length && state.results.length > 0}
            onChange={selectAll}
          />
          Select All ({selectedIds.size}/{state.results.length})
        </label>
        {selectedIds.size > 0 && (
          <div className="bulk-buttons">
            <span>Bulk assign:</span>
            <button className="eval-btn correct" onClick={() => bulkAssign('correct')}>
              Correct
            </button>
            <button className="eval-btn partial" onClick={() => bulkAssign('partial')}>
              Partial
            </button>
            <button className="eval-btn incorrect" onClick={() => bulkAssign('incorrect')}>
              Incorrect
            </button>
          </div>
        )}
      </div>

      <Modal
        isOpen={showSaveDialog}
        onClose={resetSaveDialog}
        onSubmit={handleSaveEvaluation}
        title="Save as Evaluation"
        footer={
          <>
            <button className="modal-btn cancel" onClick={resetSaveDialog}>
              Cancel
            </button>
            <button
              className="modal-btn confirm"
              onClick={handleSaveEvaluation}
              disabled={saving || !evaluationName.trim()}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <form className="modal-form" onSubmit={(e) => { e.preventDefault(); handleSaveEvaluation(); }}>
          <div className="form-group">
            <label>Evaluation Name</label>
            <input
              type="text"
              placeholder="Enter evaluation name"
              value={evaluationName}
              onChange={(e) => setEvaluationName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Description (optional)</label>
            <input
              type="text"
              placeholder="Enter description"
              value={evaluationDescription}
              onChange={(e) => setEvaluationDescription(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      <div className="results-list">
        {state.results.map((result) => (
          <div key={result.id} className={`result-card ${result.isError ? 'error' : ''} ${selectedIds.has(result.id) ? 'selected' : ''}`}>
            <div className="result-select">
              <input
                type="checkbox"
                checked={selectedIds.has(result.id)}
                onChange={() => toggleSelect(result.id)}
              />
            </div>
            <div className="result-content">
              {result.isError && (
                <div className="result-error-badge">
                  ERROR
                </div>
              )}
              <div className="result-question">
                <strong>Question:</strong> {result.question}
              </div>

              <div className={`result-answer ${result.isError ? 'error-text' : ''}`}>
                <strong>Answer:</strong> {result.answer}
              </div>

              {result.expectedAnswer && (
                <div className="result-expected">
                  <strong>Expected:</strong> {result.expectedAnswer}
                </div>
              )}

              {result.executionId && (
                <div className="result-execution-id">
                  <strong>Execution ID:</strong> <code>{result.executionId}</code>
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

              {result.humanEvaluation === 'incorrect' && (
                <div className="result-severity">
                  <span>Severity:</span>
                  <button
                    className={`severity-btn ${result.severity === 'critical' ? 'active critical' : ''}`}
                    onClick={() => handleSeverityChange(result.id, 'critical')}
                  >
                    Critical
                  </button>
                  <button
                    className={`severity-btn ${result.severity === 'major' ? 'active major' : ''}`}
                    onClick={() => handleSeverityChange(result.id, 'major')}
                  >
                    Major
                  </button>
                  <button
                    className={`severity-btn ${result.severity === 'minor' ? 'active minor' : ''}`}
                    onClick={() => handleSeverityChange(result.id, 'minor')}
                  >
                    Minor
                  </button>
                </div>
              )}

              <div className="result-description">
                <input
                  type="text"
                  placeholder="Add evaluation notes (optional)"
                  value={result.humanEvaluationDescription || ''}
                  onChange={(e) => handleDescriptionChange(result.id, e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
