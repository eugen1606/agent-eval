import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import {
  StoredRun,
  RunResult,
  HumanEvaluationStatus,
  IncorrectSeverity,
  RunStats,
  PerformanceStats,
  LLMJudgeStatusResponse,
} from '@agent-eval/shared';
import { Pagination } from '../../components/Pagination';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { useNotification } from '../../context/NotificationContext';
import { apiClient } from '../../apiClient';
import { downloadExportBundle, downloadAuthenticatedFile, generateExportFilename } from '../../shared/exportImportUtils';
import { calculateSimilarity, getSimilarityLevel } from './similarity';
import { DiffView } from './DiffView';
import { ConversationRunDetailPage } from './ConversationRunDetailPage';
import styles from './runs.module.scss';

interface CompareableRun {
  id: string;
  completedAt?: string;
  status: string;
}

function scoreToEvaluation(score: number): HumanEvaluationStatus {
  if (score >= 80) return 'correct';
  if (score >= 40) return 'partial';
  return 'incorrect';
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
  const [reRunProgress, setReRunProgress] = useState<{ completed: number; total: number } | null>(
    null
  );
  const [showReRunConfirm, setShowReRunConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // LLM evaluation state
  const [evaluators, setEvaluators] = useState<LLMJudgeStatusResponse['evaluators']>([]);
  const [showEvaluatorPicker, setShowEvaluatorPicker] = useState(false);
  const [llmEvaluating, setLlmEvaluating] = useState(false);
  const [llmEvalProgress, setLlmEvalProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [overrideExisting, setOverrideExisting] = useState(false);
  const [singleEvalResultId, setSingleEvalResultId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const loadRun = useCallback(async (showLoading = true) => {
    if (!id) return;
    if (showLoading) setLoading(true);
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
    if (showLoading) setLoading(false);
  }, [id]);

  useEffect(() => {
    loadRun();
  }, [loadRun]);

  // Poll for new results while run is still executing
  useEffect(() => {
    if (!id || !run || (run.status !== 'running' && run.status !== 'pending')) return;

    const interval = setInterval(async () => {
      const [runRes, statsRes] = await Promise.all([
        apiClient.getRun(id),
        apiClient.getRunStats(id),
      ]);
      if (runRes.success && runRes.data) {
        setRun(runRes.data);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [id, run?.status]);

  // Detect in-progress evaluation on load and start polling
  useEffect(() => {
    if (!run) return;
    if (run.evaluationInProgress && !llmEvaluating) {
      setLlmEvaluating(true);
      const completed = run.results.filter(
        (r) => r.llmJudgeScore !== undefined && r.llmJudgeScore !== null
      ).length;
      setLlmEvalProgress({
        completed,
        total: run.evaluationTotal ?? 0,
      });
    }
  }, [run?.evaluationInProgress]); // only trigger when evaluationInProgress changes

  // Poll for evaluation progress when evaluating in background
  useEffect(() => {
    if (!id || !run?.evaluationInProgress) return;

    const interval = setInterval(async () => {
      const [runRes, statsRes] = await Promise.all([
        apiClient.getRun(id),
        apiClient.getRunStats(id),
      ]);
      if (runRes.success && runRes.data) {
        setRun(runRes.data);
        const completed = runRes.data.results.filter(
          (r) => r.llmJudgeScore !== undefined && r.llmJudgeScore !== null
        ).length;
        setLlmEvalProgress({
          completed,
          total: runRes.data.evaluationTotal ?? 0,
        });
        if (!runRes.data.evaluationInProgress) {
          setLlmEvaluating(false);
          setLlmEvalProgress(null);
          showNotification('success', 'AI evaluation complete');
        }
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [id, run?.evaluationInProgress, showNotification]);

  // Close export menu on outside click
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = () => setExportMenuOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [exportMenuOpen]);

  // Load evaluators
  useEffect(() => {
    const loadEvaluators = async () => {
      const res = await apiClient.getLLMJudgeStatus();
      if (res.success && res.data) {
        setEvaluators(res.data.evaluators);
      }
    };
    loadEvaluators();
  }, []);

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

  const handleBulkLLMEvaluation = async (evaluatorId: string, isRetry = false) => {
    if (!id) return;
    setShowEvaluatorPicker(false);
    setLlmEvaluating(true);
    setLlmEvalProgress(null);

    const csrfToken = apiClient.getAuthToken();
    if (!csrfToken) {
      setLlmEvaluating(false);
      showNotification('error', 'Not authenticated. Please log in again.');
      return;
    }

    try {
      const response = await fetch(`${apiClient.getApiUrl()}/runs/${id}/evaluate-llm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          Accept: 'text/event-stream',
        },
        credentials: 'include',
        body: JSON.stringify({
          evaluatorId,
          overrideExisting,
          resultIds: singleEvalResultId ? [singleEvalResultId] : undefined,
        }),
      });

      if (response.status === 401 && !isRetry) {
        const refreshResponse = await fetch(`${apiClient.getApiUrl()}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (refreshResponse.ok) {
          setLlmEvaluating(false);
          return handleBulkLLMEvaluation(evaluatorId, true);
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
          // Use default
        }
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

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
              if (data.type === 'eval_start') {
                setLlmEvalProgress({ completed: 0, total: data.totalResults || 0 });
              }
              if (data.type === 'eval_result') {
                setLlmEvalProgress((prev) =>
                  prev ? { ...prev, completed: prev.completed + 1 } : prev
                );
              }
              if (data.type === 'eval_complete') {
                setLlmEvaluating(false);
                setLlmEvalProgress(null);
                setSingleEvalResultId(null);
                loadRun();
                showNotification(
                  'success',
                  `LLM evaluation complete: ${data.evaluatedCount} results evaluated`
                );
              }
              if (data.type === 'eval_error' && !data.resultId) {
                setLlmEvaluating(false);
                setLlmEvalProgress(null);
                setSingleEvalResultId(null);
                showNotification('error', data.error || 'LLM evaluation failed');
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      setLlmEvaluating(false);
      setLlmEvalProgress(null);
      setSingleEvalResultId(null);
      showNotification('error', error instanceof Error ? error.message : 'LLM evaluation failed');
    }
  };

  const handleAcceptAllLLM = () => {
    if (!run) return;
    run.results.forEach((result) => {
      if (result.llmJudgeScore !== undefined && result.llmJudgeScore !== null && !result.isError) {
        updateLocalResult(result.id, {
          humanEvaluation: scoreToEvaluation(result.llmJudgeScore),
        });
      }
    });
    showNotification('info', 'LLM suggestions applied. Click Save to persist.');
  };

  const handleOpenSingleEval = (resultId: string) => {
    setSingleEvalResultId(resultId);
    setShowEvaluatorPicker(true);
  };

  const toggleReasoningExpanded = (resultId: string) => {
    setExpandedReasoning((prev) => {
      const next = new Set(prev);
      if (next.has(resultId)) next.delete(resultId);
      else next.add(resultId);
      return next;
    });
  };

  const hasLLMResults = allResults.some(
    (r) => r.llmJudgeScore !== undefined && r.llmJudgeScore !== null
  );

  const evaluatedCount = evaluatableResults.filter((r) => {
    const updated = getResultWithUpdates(r);
    return updated.humanEvaluation !== undefined;
  }).length;

  const hasUnsavedChanges = pendingUpdates.size > 0;

  const handleExport = async () => {
    if (!run) return;
    setExportMenuOpen(false);
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

  const handleExportCsv = async () => {
    if (!run) return;
    setExportMenuOpen(false);
    const shortId = run.id.slice(0, 8);
    const date = new Date().toISOString().split('T')[0];
    const ok = await downloadAuthenticatedFile(
      apiClient.getRunExportCsvUrl(run.id),
      `run-${shortId}-${date}.csv`,
    );
    showNotification(ok ? 'success' : 'error', ok ? 'CSV exported' : 'Failed to export CSV');
  };

  const handleExportPdf = async () => {
    if (!run) return;
    setExportMenuOpen(false);
    const shortId = run.id.slice(0, 8);
    const date = new Date().toISOString().split('T')[0];
    const ok = await downloadAuthenticatedFile(
      apiClient.getRunExportPdfUrl(run.id),
      `run-report-${shortId}-${date}.pdf`,
    );
    showNotification(ok ? 'success' : 'error', ok ? 'PDF exported' : 'Failed to export PDF');
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

  // Delegate to ConversationRunDetailPage for conversation-type runs
  if (run.test?.type === 'conversation') {
    return <ConversationRunDetailPage run={run} onReload={loadRun} />;
  }

  return (
    <div className={styles.runDetailPage}>
      <div className={styles.runDetailHeader}>
        <div className={styles.headerTopRow}>
          <button className={styles.backBtn} onClick={() => navigate('/runs')}>
            &larr; Back to Runs
          </button>
          <div className={styles.runTitle}>
            <h2>{run.test?.name || 'Unknown Test'}</h2>
            <span className={`${styles.statusBadge} ${statusBadgeMap[run.status] || ''}`}>
              {run.status}
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
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
          <div className={styles.exportDropdown} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.exportBtn}
              onClick={() => setExportMenuOpen((prev) => !prev)}
            >
              Export &#9662;
            </button>
            {exportMenuOpen && (
              <div className={styles.exportMenu}>
                <button onClick={handleExport}>Export JSON</button>
                <button onClick={handleExportCsv}>Export CSV</button>
                <button onClick={handleExportPdf}>Export PDF</button>
              </div>
            )}
          </div>
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
          {run.status === 'completed' && evaluatableResults.length > 0 && (
            <button
              className={styles.llmEvalBtn}
              onClick={() => {
                if (evaluators.length === 0) {
                  showNotification(
                    'info',
                    'No evaluators configured. Go to Settings to create one.'
                  );
                  navigate('/settings');
                  return;
                }
                setSingleEvalResultId(null);
                setShowEvaluatorPicker(true);
              }}
              disabled={llmEvaluating}
            >
              {llmEvaluating ? 'Evaluating...' : 'AI Evaluate'}
            </button>
          )}
          <button
            className={styles.saveBtn}
            onClick={saveEvaluations}
            disabled={saving || !hasUnsavedChanges}
          >
            {saving
              ? 'Saving...'
              : hasUnsavedChanges
                ? `Save (${pendingUpdates.size} changes)`
                : 'Save'}
          </button>
        </div>
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

      {/* Evaluator Picker Modal */}
      <Modal
        isOpen={showEvaluatorPicker}
        onClose={() => {
          setShowEvaluatorPicker(false);
          setSingleEvalResultId(null);
        }}
        title={singleEvalResultId ? 'Select Evaluator' : 'Evaluate with LLM'}
      >
        <div className={styles.evaluatorPicker}>
          {evaluators.map((ev) => (
            <div key={ev.id} className={styles.evaluatorPicker + ' ' + ''}>
              <div
                className={styles.evaluatorPicker}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  marginBottom: '0.5rem',
                }}
                onClick={() => handleBulkLLMEvaluation(ev.id)}
              >
                <span style={{ fontWeight: 500 }}>{ev.name}</span>
                <span
                  style={{
                    padding: '0.2rem 0.5rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  {ev.model}
                </span>
              </div>
            </div>
          ))}
          {!singleEvalResultId && (
            <div className={styles.evaluatorPicker}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <input
                  type="checkbox"
                  checked={overrideExisting}
                  onChange={(e) => setOverrideExisting(e.target.checked)}
                />
                Override existing LLM evaluations
              </label>
            </div>
          )}
        </div>
      </Modal>

      {/* LLM Evaluation Progress */}
      {llmEvaluating && llmEvalProgress && (
        <div className={styles.llmEvalProgress}>
          <div className={styles.progressSpinner}></div>
          <span>
            Evaluating... {llmEvalProgress.completed}/{llmEvalProgress.total}
          </span>
        </div>
      )}

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
              <button
                className={`${styles.evalBtn} ${styles.correct}`}
                onClick={() => bulkAssign('correct')}
              >
                Correct
              </button>
              <button
                className={`${styles.evalBtn} ${styles.partial}`}
                onClick={() => bulkAssign('partial')}
              >
                Partial
              </button>
              <button
                className={`${styles.evalBtn} ${styles.incorrect}`}
                onClick={() => bulkAssign('incorrect')}
              >
                Incorrect
              </button>
            </div>
          )}
          {hasLLMResults && (
            <button className={styles.llmAcceptAll} onClick={handleAcceptAllLLM}>
              Accept All AI
            </button>
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
                    <button
                      className={`${styles.diffToggleBtn} ${diffToggles.has(result.id) ? styles.active : ''}`}
                      onClick={() => toggleDiff(result.id)}
                    >
                      Diff
                    </button>
                  )}
                </div>

                {diffToggles.has(result.id) && result.expectedAnswer && result.answer && (
                  <>
                    <span
                      className={`${styles.similarityBadge} ${styles[getSimilarityLevel(calculateSimilarity(result.expectedAnswer, result.answer))]}`}
                    >
                      {calculateSimilarity(result.expectedAnswer, result.answer)}% match
                    </span>
                    <DiffView expected={result.expectedAnswer} actual={result.answer} />
                  </>
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
                  {result.sessionId && (
                    <span className={styles.resultExecutionId}>
                      <strong>Session ID:</strong> <code>{result.sessionId}</code>
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

                    {/* LLM Judge Section */}
                    {displayResult.llmJudgeScore !== undefined &&
                      displayResult.llmJudgeScore !== null && (
                        <div className={styles.llmJudgeSection}>
                          <span className={styles.llmScore}>{displayResult.llmJudgeScore}/100</span>
                          <span
                            className={`${styles.llmSuggestion} ${styles[scoreToEvaluation(displayResult.llmJudgeScore)]}`}
                          >
                            {scoreToEvaluation(displayResult.llmJudgeScore)
                              .charAt(0)
                              .toUpperCase() +
                              scoreToEvaluation(displayResult.llmJudgeScore).slice(1)}
                          </span>
                          <button
                            className={styles.acceptBtn}
                            onClick={() =>
                              updateLocalResult(result.id, {
                                humanEvaluation: scoreToEvaluation(
                                  displayResult.llmJudgeScore ?? 0
                                ),
                              })
                            }
                          >
                            Accept
                          </button>
                          {displayResult.llmJudgeReasoning && (
                            <div className={styles.llmReasoning}>
                              <div
                                className={`reasoningText ${expandedReasoning.has(result.id) ? 'expanded' : ''}`}
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: expandedReasoning.has(result.id) ? 'unset' : 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: expandedReasoning.has(result.id) ? 'visible' : 'hidden',
                                  whiteSpace: 'pre-wrap',
                                }}
                              >
                                {displayResult.llmJudgeReasoning}
                              </div>
                              <button
                                className={styles.llmReasoning + ' '}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--accent-primary)',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  padding: 0,
                                  marginTop: '0.25rem',
                                }}
                                onClick={() => toggleReasoningExpanded(result.id)}
                              >
                                {expandedReasoning.has(result.id) ? 'Show less' : 'Show more'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                    {/* Single result AI eval button */}
                    {evaluators.length > 0 && !displayResult.llmJudgeScore && !llmEvaluating && (
                      <button
                        className={styles.llmEvalSingleBtn}
                        onClick={() => handleOpenSingleEval(result.id)}
                        style={{ marginTop: '0.5rem' }}
                      >
                        AI Evaluate
                      </button>
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
