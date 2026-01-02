import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { AgentEvalClient } from '@agent-eval/api-client';
import { HumanEvaluationStatus, IncorrectSeverity } from '@agent-eval/shared';
import { Modal } from './Modal';

const apiClient = new AgentEvalClient();

export function EvaluationResults() {
  const { state, updateResult, setLoading, clearLoadedEvaluation } = useAppContext();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [evaluationName, setEvaluationName] = useState('');
  const [evaluationDescription, setEvaluationDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter out error results for evaluation purposes
  const evaluatableResults = state.results.filter(r => !r.isError);
  const errorResults = state.results.filter(r => r.isError);

  const resetSaveDialog = () => {
    setEvaluationName('');
    setEvaluationDescription('');
    setShowSaveDialog(false);
  };

  const toggleSelect = (id: string) => {
    // Only allow selecting non-error results
    const result = state.results.find(r => r.id === id);
    if (result?.isError) return;

    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    // Only select non-error results
    if (selectedIds.size === evaluatableResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(evaluatableResults.map(r => r.id)));
    }
  };

  const bulkAssign = (status: HumanEvaluationStatus) => {
    const isCorrect = status === 'correct' ? true : status === 'incorrect' ? false : undefined;
    selectedIds.forEach(id => {
      // Double-check it's not an error result
      const result = state.results.find(r => r.id === id);
      if (result && !result.isError) {
        updateResult(id, { humanEvaluation: status, isCorrect });
      }
    });
    setSelectedIds(new Set());
  };

  const handleHumanEvaluation = (id: string, status: HumanEvaluationStatus) => {
    // Don't allow evaluation of error results
    const result = state.results.find(r => r.id === id);
    if (result?.isError) return;

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
    if (!result || result.isError) return;

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
    for (const result of evaluatableResults) {
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

  const handleUpdateEvaluation = async () => {
    if (!state.loadedEvaluationId) return;

    setSaving(true);
    const response = await apiClient.updateEvaluation(state.loadedEvaluationId, {
      finalOutput: {
        config: state.config,
        results: state.results,
        savedAt: new Date().toISOString(),
      },
    });

    if (response.success) {
      // Keep the evaluation loaded but show success
      setSaving(false);
    }
    setSaving(false);
  };

  const handleFinishEvaluating = () => {
    clearLoadedEvaluation();
  };

  // Only count non-error results as evaluatable
  const evaluatedCount = evaluatableResults.filter(
    r => r.humanEvaluation !== undefined
  ).length;

  const hasResults = state.results.length > 0;

  return (
    <div className="evaluation-results">
      {state.loadedEvaluationId && (
        <div className="continue-evaluation-banner">
          <span>Continuing evaluation from stored data</span>
          <div className="banner-actions">
            <button
              onClick={handleUpdateEvaluation}
              disabled={saving}
              className="update-btn"
            >
              {saving ? 'Saving...' : 'Save Progress'}
            </button>
            <button onClick={handleFinishEvaluating} className="finish-btn">
              Finish
            </button>
          </div>
        </div>
      )}
      <div className="results-header">
        <h2>Evaluation Results</h2>
        {hasResults && (
          <span className="evaluation-progress">
            {evaluatedCount}/{evaluatableResults.length} evaluated
            {errorResults.length > 0 && (
              <span className="error-count"> ({errorResults.length} errors)</span>
            )}
          </span>
        )}
        {!state.loadedEvaluationId && (
          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={!hasResults}
          >
            Save as Evaluation
          </button>
        )}
      </div>

      {!hasResults ? (
        <div className="empty-results">
          <p>No results yet. Execute a flow to see results here.</p>
        </div>
      ) : (
        <>
      <div className="bulk-actions">
        <label className="select-all">
          <input
            type="checkbox"
            checked={selectedIds.size === evaluatableResults.length && evaluatableResults.length > 0}
            onChange={selectAll}
            disabled={evaluatableResults.length === 0}
          />
          Select All ({selectedIds.size}/{evaluatableResults.length})
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
                disabled={result.isError}
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

              <div className="result-expected">
                <strong>Expected:</strong> {result.expectedAnswer || <span className="na-value">N/A</span>}
              </div>

              {result.executionId && (
                <div className="result-execution-id">
                  <strong>Execution ID:</strong> <code>{result.executionId}</code>
                </div>
              )}

              {!result.isError ? (
                <>
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
                </>
              ) : (
                <div className="result-error-note">
                  This result cannot be evaluated due to an error during execution.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
        </>
      )}
    </div>
  );
}
