import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import {
  StoredRun,
  RunResult,
  HumanEvaluationStatus,
  IncorrectSeverity,
  RunStats,
  PerformanceStats,
} from '@agent-eval/shared';
import { Pagination } from './Pagination';
import { useNotification } from '../context/NotificationContext';
import { apiClient } from '../apiClient';

interface CompareableRun {
  id: string;
  completedAt?: string;
  status: string;
}

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [run, setRun] = useState<StoredRun | null>(null);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [perfStats, setPerfStats] = useState<PerformanceStats | null>(null);
  const [otherRuns, setOtherRuns] = useState<CompareableRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingUpdates, setPendingUpdates] = useState<
    Map<string, Partial<RunResult>>
  >(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const loadRun = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [runRes, statsRes, perfRes] = await Promise.all([
      apiClient.getRun(id),
      apiClient.getRunStats(id),
      apiClient.getRunPerformance(id),
    ]);
    if (runRes.success && runRes.data) {
      setRun(runRes.data);
      // Load other runs of the same test for comparison
      if (runRes.data.testId) {
        const otherRunsRes = await apiClient.getRuns({
          testId: runRes.data.testId,
          limit: 50,
          sortBy: 'completedAt',
          sortDirection: 'desc',
        });
        if (otherRunsRes.success && otherRunsRes.data) {
          // Filter out the current run and only keep completed runs
          const filteredRuns = otherRunsRes.data.data
            .filter((r) => r.id !== id && r.status === 'completed')
            .map((r) => ({
              id: r.id,
              completedAt: r.completedAt,
              status: r.status,
            }));
          setOtherRuns(filteredRuns);
        }
      }
    }
    if (statsRes.success && statsRes.data) {
      setStats(statsRes.data);
    }
    if (perfRes.success && perfRes.data) {
      setPerfStats(perfRes.data);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadRun();
  }, [loadRun]);

  // Apply pending updates locally to run state
  const getResultWithUpdates = (result: RunResult): RunResult => {
    const updates = pendingUpdates.get(result.id);
    if (updates) {
      return { ...result, ...updates };
    }
    return result;
  };

  const allResults = run?.results || [];
  const evaluatableResults = allResults.filter((r) => !r.isError);
  const errorResults = allResults.filter((r) => r.isError);

  // Pagination for results
  const totalPages = Math.ceil(allResults.length / itemsPerPage);
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return allResults.slice(start, start + itemsPerPage);
  }, [allResults, currentPage, itemsPerPage]);

  // Reset page if out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [allResults.length, currentPage, totalPages]);

  const toggleSelect = (resultId: string) => {
    const result = run?.results.find((r) => r.id === resultId);
    if (result?.isError) return;

    const newSelected = new Set(selectedIds);
    if (newSelected.has(resultId)) {
      newSelected.delete(resultId);
    } else {
      newSelected.add(resultId);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === evaluatableResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(evaluatableResults.map((r) => r.id)));
    }
  };

  const updateLocalResult = (resultId: string, updates: Partial<RunResult>) => {
    setPendingUpdates((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(resultId) || {};
      newMap.set(resultId, { ...existing, ...updates });
      return newMap;
    });
  };

  const handleHumanEvaluation = (
    resultId: string,
    status: HumanEvaluationStatus,
  ) => {
    const result = run?.results.find((r) => r.id === resultId);
    if (result?.isError) return;
    updateLocalResult(resultId, { humanEvaluation: status });
  };

  const handleSeverityChange = (
    resultId: string,
    severity: IncorrectSeverity,
  ) => {
    updateLocalResult(resultId, { severity });
  };

  const handleDescriptionChange = (resultId: string, description: string) => {
    updateLocalResult(resultId, { humanEvaluationDescription: description });
  };

  const bulkAssign = (status: HumanEvaluationStatus) => {
    selectedIds.forEach((resultId) => {
      const result = run?.results.find((r) => r.id === resultId);
      if (result && !result.isError) {
        updateLocalResult(resultId, { humanEvaluation: status });
      }
    });
    setSelectedIds(new Set());
  };

  const saveEvaluations = async () => {
    if (!id || pendingUpdates.size === 0) return;

    setSaving(true);
    const updates = Array.from(pendingUpdates.entries()).map(
      ([resultId, data]) => ({
        resultId,
        humanEvaluation: data.humanEvaluation,
        humanEvaluationDescription: data.humanEvaluationDescription,
        severity: data.severity,
      }),
    );

    const response = await apiClient.bulkUpdateResultEvaluations(id, updates);
    if (response.success) {
      setPendingUpdates(new Map());
      loadRun(); // Reload to get fresh data
      showNotification('success', 'Evaluations saved successfully');
    } else {
      showNotification('error', response.error || 'Failed to save evaluations');
    }
    setSaving(false);
  };

  const evaluatedCount = evaluatableResults.filter((r) => {
    const updated = getResultWithUpdates(r);
    return updated.humanEvaluation !== undefined;
  }).length;

  const hasUnsavedChanges = pendingUpdates.size > 0;

  // Block all navigation (back button, links, etc.) when there are unsaved changes
  const blocker = useBlocker(hasUnsavedChanges);

  // Handle blocker state - show native confirm dialog
  useEffect(() => {
    if (blocker.state === 'blocked') {
      const shouldLeave = window.confirm(
        'You have unsaved changes. Are you sure you want to leave this page?',
      );
      if (shouldLeave) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  // Warn user before browser-level navigation (close tab, refresh, etc.)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        // Modern browsers ignore custom messages, but this is still required
        e.returnValue =
          'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (loading) {
    return (
      <div className="run-detail-page">
        <div className="loading-state">Loading run...</div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="run-detail-page">
        <div className="error-state">Run not found</div>
      </div>
    );
  }

  return (
    <div className="run-detail-page">
      <div className="run-detail-header">
        <button className="back-btn" onClick={() => navigate('/runs')}>
          &larr; Back to Runs
        </button>
        <div className="run-title">
          <h2>{run.test?.name || 'Unknown Test'}</h2>
          <span className={`status-badge badge-${run.status}`}>
            {run.status}
          </span>
        </div>
        {otherRuns.length > 0 && run.status === 'completed' && (
          <select
            className="compare-dropdown"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                navigate(`/runs/${id}/compare/${e.target.value}`);
              }
            }}
          >
            <option value="">Compare with...</option>
            {otherRuns.map((otherRun) => (
              <option key={otherRun.id} value={otherRun.id}>
                {otherRun.completedAt
                  ? new Date(otherRun.completedAt).toLocaleString()
                  : `Run ${otherRun.id.slice(0, 8)}`}
              </option>
            ))}
          </select>
        )}
        {hasUnsavedChanges && (
          <button
            className="save-btn"
            onClick={saveEvaluations}
            disabled={saving}
          >
            {saving ? 'Saving...' : `Save (${pendingUpdates.size} changes)`}
          </button>
        )}
      </div>

      {/* Stats Summary */}
      {stats && run.status === 'completed' && (
        <div className="run-stats-bar">
          <div className="stat-item">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-item correct">
            <span className="stat-value">{stats.correct}</span>
            <span className="stat-label">Correct</span>
          </div>
          <div className="stat-item partial">
            <span className="stat-value">{stats.partial}</span>
            <span className="stat-label">Partial</span>
          </div>
          <div className="stat-item incorrect">
            <span className="stat-value">{stats.incorrect}</span>
            <span className="stat-label">Incorrect</span>
          </div>
          {stats.errors > 0 && (
            <div className="stat-item errors">
              <span className="stat-value">{stats.errors}</span>
              <span className="stat-label">Errors</span>
            </div>
          )}
          {stats.accuracy !== null && (
            <div className="stat-item accuracy">
              <span className="stat-value">{stats.accuracy}%</span>
              <span className="stat-label">Accuracy</span>
            </div>
          )}
        </div>
      )}

      {/* Performance Summary */}
      {perfStats && perfStats.count > 0 && run.status === 'completed' && (
        <div className="run-perf-bar">
          <div className="perf-title">Performance</div>
          <div className="perf-stats">
            <div className="perf-item">
              <span className="perf-value">{perfStats.min}ms</span>
              <span className="perf-label">Min</span>
            </div>
            <div className="perf-item">
              <span className="perf-value">{perfStats.avg}ms</span>
              <span className="perf-label">Avg</span>
            </div>
            <div className="perf-item">
              <span className="perf-value">{perfStats.p50}ms</span>
              <span className="perf-label">P50</span>
            </div>
            <div className="perf-item">
              <span className="perf-value">{perfStats.p95}ms</span>
              <span className="perf-label">P95</span>
            </div>
            <div className="perf-item">
              <span className="perf-value">{perfStats.max}ms</span>
              <span className="perf-label">Max</span>
            </div>
          </div>
        </div>
      )}

      {/* Progress indicator */}
      <div className="evaluation-progress-bar">
        <span>
          {evaluatedCount}/{evaluatableResults.length} evaluated
          {errorResults.length > 0 && (
            <span className="error-count"> ({errorResults.length} errors)</span>
          )}
        </span>
      </div>

      {/* Bulk Actions */}
      {evaluatableResults.length > 0 && (
        <div className="bulk-actions">
          <label className="select-all">
            <input
              type="checkbox"
              checked={
                selectedIds.size === evaluatableResults.length &&
                evaluatableResults.length > 0
              }
              onChange={selectAll}
            />
            Select All ({selectedIds.size}/{evaluatableResults.length})
          </label>
          {selectedIds.size > 0 && (
            <div className="bulk-buttons">
              <span>Bulk assign:</span>
              <button
                className="eval-btn correct"
                onClick={() => bulkAssign('correct')}
              >
                Correct
              </button>
              <button
                className="eval-btn partial"
                onClick={() => bulkAssign('partial')}
              >
                Partial
              </button>
              <button
                className="eval-btn incorrect"
                onClick={() => bulkAssign('incorrect')}
              >
                Incorrect
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results List */}
      <div className="results-list">
        {paginatedResults.map((result) => {
          const displayResult = getResultWithUpdates(result);
          return (
            <div
              key={result.id}
              className={`result-card ${result.isError ? 'error' : ''} ${
                selectedIds.has(result.id) ? 'selected' : ''
              }`}
            >
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
                  <div className="result-error-badge">ERROR</div>
                )}
                <div className="result-question">
                  <strong>Question:</strong> {result.question}
                </div>

                <div
                  className={`result-answer ${result.isError ? 'error-text' : ''}`}
                >
                  <strong>Answer:</strong> {result.answer}
                </div>

                <div className="result-expected">
                  <strong>Expected:</strong>{' '}
                  {result.expectedAnswer || (
                    <span className="na-value">N/A</span>
                  )}
                </div>

                <div className="result-meta">
                  {result.executionTimeMs !== undefined && (
                    <span className="result-latency">
                      <strong>Latency:</strong> {result.executionTimeMs}ms
                    </span>
                  )}
                  {result.executionId && (
                    <span className="result-execution-id">
                      <strong>Execution ID:</strong>{' '}
                      <code>{result.executionId}</code>
                    </span>
                  )}
                </div>

                {!result.isError ? (
                  <>
                    <div className="result-actions">
                      <span>Human Evaluation:</span>
                      <button
                        className={`eval-btn ${
                          displayResult.humanEvaluation === 'correct'
                            ? 'active correct'
                            : ''
                        }`}
                        onClick={() =>
                          handleHumanEvaluation(result.id, 'correct')
                        }
                      >
                        Correct
                      </button>
                      <button
                        className={`eval-btn ${
                          displayResult.humanEvaluation === 'partial'
                            ? 'active partial'
                            : ''
                        }`}
                        onClick={() =>
                          handleHumanEvaluation(result.id, 'partial')
                        }
                      >
                        Partial
                      </button>
                      <button
                        className={`eval-btn ${
                          displayResult.humanEvaluation === 'incorrect'
                            ? 'active incorrect'
                            : ''
                        }`}
                        onClick={() =>
                          handleHumanEvaluation(result.id, 'incorrect')
                        }
                      >
                        Incorrect
                      </button>
                    </div>

                    {displayResult.humanEvaluation === 'incorrect' && (
                      <div className="result-severity">
                        <span>Severity:</span>
                        <button
                          className={`severity-btn ${
                            displayResult.severity === 'critical'
                              ? 'active critical'
                              : ''
                          }`}
                          onClick={() =>
                            handleSeverityChange(result.id, 'critical')
                          }
                        >
                          Critical
                        </button>
                        <button
                          className={`severity-btn ${
                            displayResult.severity === 'major'
                              ? 'active major'
                              : ''
                          }`}
                          onClick={() =>
                            handleSeverityChange(result.id, 'major')
                          }
                        >
                          Major
                        </button>
                        <button
                          className={`severity-btn ${
                            displayResult.severity === 'minor'
                              ? 'active minor'
                              : ''
                          }`}
                          onClick={() =>
                            handleSeverityChange(result.id, 'minor')
                          }
                        >
                          Minor
                        </button>
                      </div>
                    )}

                    <div className="result-description">
                      <input
                        type="text"
                        placeholder="Add evaluation notes (optional)"
                        value={displayResult.humanEvaluationDescription || ''}
                        onChange={(e) =>
                          handleDescriptionChange(result.id, e.target.value)
                        }
                      />
                    </div>
                  </>
                ) : (
                  <div className="result-error-note">
                    This result cannot be evaluated due to an error during
                    execution.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={allResults.length}
        itemsPerPage={itemsPerPage}
        itemName="results"
      />
    </div>
  );
}
