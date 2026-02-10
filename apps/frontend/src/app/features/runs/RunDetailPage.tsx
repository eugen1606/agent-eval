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
import { Pagination } from '../../components/Pagination';
import { ConfirmDialog } from '../../components/Modal';
import { useNotification } from '../../context/NotificationContext';
import { apiClient } from '../../apiClient';
import { downloadExportBundle, generateExportFilename } from '../../shared/exportImportUtils';
import { calculateSimilarity, getSimilarityLevel } from './similarity';
import { DiffView } from './DiffView';
import styles from './runs.module.scss';

interface CompareableRun {
  id: string;
  completedAt?: string;
  status: string;
}

const statusBadgeMap: Record<string, string> = {
  pending: styles.badgePending,
  running: styles.badgeRunning,
  completed: styles.badgeCompleted,
  failed: styles.badgeFailed,
  canceled: styles.badgeCanceled,
};

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
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, Partial<RunResult>>>(new Map());
  const [diffToggles, setDiffToggles] = useState<Set<string>>(new Set());
  const [reRunning, setReRunning] = useState(false);
  const [reRunProgress, setReRunProgress] = useState<{ completed: number; total: number } | null>(null);
  const [showReRunConfirm, setShowReRunConfirm] = useState(false);
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

  const handleHumanEvaluation = (resultId: string, status: HumanEvaluationStatus) => {
    const result = run?.results.find((r) => r.id === resultId);
    if (result?.isError) return;
    updateLocalResult(resultId, { humanEvaluation: status });
  };

  const handleSeverityChange = (resultId: string, severity: IncorrectSeverity) => {
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
    const updates = Array.from(pendingUpdates.entries()).map(([resultId, data]) => ({
      resultId,
      humanEvaluation: data.humanEvaluation,
      humanEvaluationDescription: data.humanEvaluationDescription,
      severity: data.severity,
    }));

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

  const handleExport = async () => {
    if (!run) return;
    const response = await apiClient.exportConfig({
      types: ['runs'],
      runIds: [run.id],
    });
    if (response.success && response.data) {
      const filename = generateExportFilename('run', run.test?.name || run.id);
      downloadExportBundle(response.data, filename);
      showNotification('success', 'Run exported successfully');
    } else {
      showNotification('error', response.error || 'Failed to export run');
    }
  };

  const toggleDiff = (resultId: string) => {
    setDiffToggles((prev) => {
      const next = new Set(prev);
      if (next.has(resultId)) {
        next.delete(resultId);
      } else {
        next.add(resultId);
      }
      return next;
    });
  };

  const handleReRun = async (isRetry = false) => {
    if (!run?.testId) return;

    const testId = run.testId;
    setReRunning(true);
    setReRunProgress(null);

    const csrfToken = apiClient.getAuthToken();
    if (!csrfToken) {
      setReRunning(false);
      showNotification('error', 'Not authenticated. Please log in again.');
      return;
    }

    try {
      const response = await fetch(`${apiClient.getApiUrl()}/tests/${testId}/run`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
          Accept: 'text/event-stream',
        },
        credentials: 'include',
      });

      if (response.status === 401 && !isRetry) {
        const refreshResponse = await fetch(`${apiClient.getApiUrl()}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (refreshResponse.ok) {
          setReRunning(false);
          return handleReRun(true);
        } else {
          throw new Error('Session expired. Please log in again.');
        }
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Use default error message
        }
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let newRunId = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'run_start' && data.runId) {
                newRunId = data.runId;
                setReRunProgress({ completed: 0, total: data.totalQuestions || 0 });
              }
              if (data.type === 'result') {
                setReRunProgress((prev) =>
                  prev ? { ...prev, completed: prev.completed + 1 } : prev
                );
              }
              if (data.type === 'complete') {
                setReRunning(false);
                setReRunProgress(null);
                if (newRunId) {
                  navigate(`/runs/${newRunId}`);
                }
              }
              if (data.type === 'error') {
                setReRunning(false);
                setReRunProgress(null);
                showNotification('error', data.message || 'Re-run failed');
              }
              if (data.type === 'canceled') {
                setReRunning(false);
                setReRunProgress(null);
                showNotification('info', 'Re-run was canceled');
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      setReRunning(false);
      setReRunProgress(null);
      showNotification('error', error instanceof Error ? error.message : 'Failed to re-run test');
    }
  };

  // Block all navigation (back button, links, etc.) when there are unsaved changes
  const blocker = useBlocker(hasUnsavedChanges);

  // Handle blocker state - show native confirm dialog
  useEffect(() => {
    if (blocker.state === 'blocked') {
      const shouldLeave = window.confirm(
        'You have unsaved changes. Are you sure you want to leave this page?'
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
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (loading) {
    return (
      <div className={styles.runDetailPage}>
        <div className={styles.loadingState}>Loading run...</div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className={styles.runDetailPage}>
        <div className={styles.errorState}>Run not found</div>
      </div>
    );
  }

  return (
    <div className={styles.runDetailPage}>
      <div className={styles.runDetailHeader}>
        <button className={styles.backBtn} onClick={() => navigate('/runs')}>
          &larr; Back to Runs
        </button>
        <div className={styles.runTitle}>
          <h2>{run.test?.name || 'Unknown Test'}</h2>
          <span className={`${styles.statusBadge} ${statusBadgeMap[run.status] || ''}`}>{run.status}</span>
        </div>
        {otherRuns.length > 0 && run.status === 'completed' && (
          <select
            className={styles.compareDropdown}
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
        <button className={styles.exportBtn} onClick={handleExport}>
          Export
        </button>
        {run.testId && (
          <button
            className={styles.reRunBtn}
            onClick={() => setShowReRunConfirm(true)}
            disabled={reRunning || run.status === 'running'}
          >
            {reRunning && reRunProgress
              ? `Re-running... (${reRunProgress.completed}/${reRunProgress.total})`
              : reRunning
                ? 'Starting...'
                : 'Re-Run Test'}
          </button>
        )}
        <button
          className={styles.saveBtn}
          onClick={saveEvaluations}
          disabled={saving || !hasUnsavedChanges}
        >
          {saving ? 'Saving...' : hasUnsavedChanges ? `Save (${pendingUpdates.size} changes)` : 'Save'}
        </button>
      </div>

      <ConfirmDialog
        isOpen={showReRunConfirm}
        onClose={() => setShowReRunConfirm(false)}
        onConfirm={handleReRun}
        title="Re-Run Test"
        message={`This will create a new run for "${run.test?.name || 'this test'}". The current run will not be affected.`}
        confirmText="Re-Run"
        variant="info"
      />

      {/* Stats Summary */}
      {stats && run.status === 'completed' && (
        <div className={styles.runStatsBar}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.total}</span>
            <span className={styles.statLabel}>Total</span>
          </div>
          <div className={`${styles.statItem} ${styles.correct}`}>
            <span className={styles.statValue}>{stats.correct}</span>
            <span className={styles.statLabel}>Correct</span>
          </div>
          <div className={`${styles.statItem} ${styles.partial}`}>
            <span className={styles.statValue}>{stats.partial}</span>
            <span className={styles.statLabel}>Partial</span>
          </div>
          <div className={`${styles.statItem} ${styles.incorrect}`}>
            <span className={styles.statValue}>{stats.incorrect}</span>
            <span className={styles.statLabel}>Incorrect</span>
          </div>
          {stats.errors > 0 && (
            <div className={`${styles.statItem} ${styles.errors}`}>
              <span className={styles.statValue}>{stats.errors}</span>
              <span className={styles.statLabel}>Errors</span>
            </div>
          )}
          {stats.accuracy !== null && (
            <div className={`${styles.statItem} ${styles.accuracy}`}>
              <span className={styles.statValue}>{stats.accuracy}%</span>
              <span className={styles.statLabel}>Accuracy</span>
            </div>
          )}
        </div>
      )}

      {/* Performance Summary */}
      {perfStats && perfStats.count > 0 && run.status === 'completed' && (
        <div className={styles.runPerfBar}>
          <div className={styles.perfTitle}>Performance</div>
          <div className={styles.perfStats}>
            <div className={styles.perfItem}>
              <span className={styles.perfValue}>{perfStats.min}ms</span>
              <span className={styles.perfLabel}>Min</span>
            </div>
            <div className={styles.perfItem}>
              <span className={styles.perfValue}>{perfStats.avg}ms</span>
              <span className={styles.perfLabel}>Avg</span>
            </div>
            <div className={styles.perfItem}>
              <span className={styles.perfValue}>{perfStats.p50}ms</span>
              <span className={styles.perfLabel}>P50</span>
            </div>
            <div className={styles.perfItem}>
              <span className={styles.perfValue}>{perfStats.p95}ms</span>
              <span className={styles.perfLabel}>P95</span>
            </div>
            <div className={styles.perfItem}>
              <span className={styles.perfValue}>{perfStats.max}ms</span>
              <span className={styles.perfLabel}>Max</span>
            </div>
          </div>
        </div>
      )}

      {/* Progress indicator */}
      <div className={styles.evaluationProgressBar}>
        <span>
          {evaluatedCount}/{evaluatableResults.length} evaluated
          {errorResults.length > 0 && (
            <span className={styles.errorCount}> ({errorResults.length} errors)</span>
          )}
        </span>
      </div>

      {/* Bulk Actions */}
      {evaluatableResults.length > 0 && (
        <div className={styles.bulkActions}>
          <label className={styles.selectAll}>
            <input
              type="checkbox"
              checked={
                selectedIds.size === evaluatableResults.length && evaluatableResults.length > 0
              }
              onChange={selectAll}
            />
            Select All ({selectedIds.size}/{evaluatableResults.length})
          </label>
          {selectedIds.size > 0 && (
            <div className={styles.bulkButtons}>
              <span>Bulk assign:</span>
              <button className={`${styles.evalBtn} ${styles.correct}`} onClick={() => bulkAssign('correct')}>
                Correct
              </button>
              <button className={`${styles.evalBtn} ${styles.partial}`} onClick={() => bulkAssign('partial')}>
                Partial
              </button>
              <button className={`${styles.evalBtn} ${styles.incorrect}`} onClick={() => bulkAssign('incorrect')}>
                Incorrect
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results List */}
      <div className={styles.resultsList}>
        {paginatedResults.map((result) => {
          const displayResult = getResultWithUpdates(result);
          return (
            <div
              key={result.id}
              className={`${styles.resultCard} ${result.isError ? styles.error : ''} ${selectedIds.has(result.id) ? styles.selected : ''}`}
            >
              <div className={styles.resultSelect}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(result.id)}
                  onChange={() => toggleSelect(result.id)}
                  disabled={result.isError}
                />
              </div>
              <div className={styles.resultContent}>
                {result.isError && <div className={styles.resultErrorBadge}>ERROR</div>}
                <div className={styles.resultQuestion}>
                  <strong>Question:</strong> {result.question}
                </div>

                <div className={`${styles.resultAnswer} ${result.isError ? styles.errorText : ''}`}>
                  <strong>Answer:</strong> {result.answer}
                </div>

                <div className={styles.resultExpected}>
                  <strong>Expected:</strong>{' '}
                  {result.expectedAnswer || <span className={styles.naValue}>N/A</span>}
                  {!result.isError && result.expectedAnswer && result.answer && (
                    <>
                      <span
                        className={`${styles.similarityBadge} ${styles[getSimilarityLevel(calculateSimilarity(result.expectedAnswer, result.answer))]}`}
                      >
                        {calculateSimilarity(result.expectedAnswer, result.answer)}% match
                      </span>
                      <button
                        className={`${styles.diffToggleBtn} ${diffToggles.has(result.id) ? styles.active : ''}`}
                        onClick={() => toggleDiff(result.id)}
                      >
                        Diff
                      </button>
                    </>
                  )}
                </div>

                {diffToggles.has(result.id) && result.expectedAnswer && result.answer && (
                  <DiffView expected={result.expectedAnswer} actual={result.answer} />
                )}

                <div className={styles.resultMeta}>
                  {result.executionTimeMs !== undefined && (
                    <span className={styles.resultLatency}>
                      <strong>Latency:</strong> {result.executionTimeMs}ms
                    </span>
                  )}
                  {result.executionId && (
                    <span className={styles.resultExecutionId}>
                      <strong>Execution ID:</strong> <code>{result.executionId}</code>
                    </span>
                  )}
                </div>

                {!result.isError ? (
                  <>
                    <div className={styles.resultActions}>
                      <span>Human Evaluation:</span>
                      <button
                        className={`${styles.evalBtn} ${displayResult.humanEvaluation === 'correct' ? `${styles.active} ${styles.correct}` : ''}`}
                        onClick={() => handleHumanEvaluation(result.id, 'correct')}
                      >
                        Correct
                      </button>
                      <button
                        className={`${styles.evalBtn} ${displayResult.humanEvaluation === 'partial' ? `${styles.active} ${styles.partial}` : ''}`}
                        onClick={() => handleHumanEvaluation(result.id, 'partial')}
                      >
                        Partial
                      </button>
                      <button
                        className={`${styles.evalBtn} ${displayResult.humanEvaluation === 'incorrect' ? `${styles.active} ${styles.incorrect}` : ''}`}
                        onClick={() => handleHumanEvaluation(result.id, 'incorrect')}
                      >
                        Incorrect
                      </button>
                    </div>

                    {displayResult.humanEvaluation === 'incorrect' && (
                      <div className={styles.resultSeverity}>
                        <span>Severity:</span>
                        <button
                          className={`${styles.severityBtn} ${displayResult.severity === 'critical' ? `${styles.active} ${styles.critical}` : ''}`}
                          onClick={() => handleSeverityChange(result.id, 'critical')}
                        >
                          Critical
                        </button>
                        <button
                          className={`${styles.severityBtn} ${displayResult.severity === 'major' ? `${styles.active} ${styles.major}` : ''}`}
                          onClick={() => handleSeverityChange(result.id, 'major')}
                        >
                          Major
                        </button>
                        <button
                          className={`${styles.severityBtn} ${displayResult.severity === 'minor' ? `${styles.active} ${styles.minor}` : ''}`}
                          onClick={() => handleSeverityChange(result.id, 'minor')}
                        >
                          Minor
                        </button>
                      </div>
                    )}

                    <div className={styles.resultDescription}>
                      <input
                        type="text"
                        placeholder="Add evaluation notes (optional)"
                        value={displayResult.humanEvaluationDescription || ''}
                        onChange={(e) => handleDescriptionChange(result.id, e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <div className={styles.resultErrorNote}>
                    This result cannot be evaluated due to an error during execution.
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
