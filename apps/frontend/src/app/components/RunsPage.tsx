import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { StoredRun, RunResult } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { ConfirmDialog } from './Modal';

const apiClient = new AgentEvalClient();

type RunStatusBadge = {
  [key: string]: { label: string; className: string };
};

const STATUS_BADGES: RunStatusBadge = {
  pending: { label: 'Pending', className: 'badge-pending' },
  running: { label: 'Running', className: 'badge-running' },
  completed: { label: 'Completed', className: 'badge-completed' },
  failed: { label: 'Failed', className: 'badge-failed' },
};

export function RunsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [activeRun, setActiveRun] = useState<{
    id: string;
    results: RunResult[];
    status: string;
    error?: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });

  const loadRuns = useCallback(async () => {
    const response = await apiClient.getRuns();
    if (response.success && response.data) {
      setRuns(response.data);
    }
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  // Handle running a test from query param
  useEffect(() => {
    const runTestId = searchParams.get('runTest');
    if (runTestId) {
      startTestRun(runTestId);
      // Clear the query param
      navigate('/runs', { replace: true });
    }
  }, [searchParams, navigate]);

  const startTestRun = async (testId: string) => {
    const token = apiClient.getAuthToken();
    if (!token) return;

    setActiveRun({ id: '', results: [], status: 'starting' });

    try {
      const response = await fetch(
        `http://localhost:3001/api/tests/${testId}/run`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
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
              handleStreamEvent(data);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      setActiveRun((prev) =>
        prev ? { ...prev, status: 'failed', error: errorMessage } : null
      );
    }
  };

  const handleStreamEvent = (data: {
    type: string;
    runId?: string;
    result?: RunResult;
    error?: string;
  }) => {
    switch (data.type) {
      case 'run_start':
        setActiveRun((prev) => ({
          id: data.runId || '',
          results: prev?.results || [],
          status: 'running',
        }));
        break;
      case 'result':
        if (data.result) {
          const newResult = data.result;
          setActiveRun((prev) =>
            prev
              ? { ...prev, results: [...prev.results, newResult] }
              : null
          );
        }
        break;
      case 'complete':
        setActiveRun((prev) => (prev ? { ...prev, status: 'completed' } : null));
        loadRuns();
        break;
      case 'error':
        setActiveRun((prev) =>
          prev ? { ...prev, status: 'failed', error: data.error } : null
        );
        loadRuns();
        break;
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    await apiClient.deleteRun(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    loadRuns();
  };

  const handleViewRun = (runId: string) => {
    navigate(`/runs/${runId}`);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getAccuracyDisplay = (run: StoredRun) => {
    if (run.status !== 'completed') return null;
    const evaluated = run.results.filter(
      (r) => r.humanEvaluation && !r.isError
    ).length;
    const total = run.results.filter((r) => !r.isError).length;
    if (evaluated === 0) return <span className="accuracy-pending">Not evaluated</span>;
    if (evaluated < total) return <span className="accuracy-partial">{evaluated}/{total} evaluated</span>;

    const correct = run.results.filter((r) => r.humanEvaluation === 'correct').length;
    const partial = run.results.filter((r) => r.humanEvaluation === 'partial').length;
    const accuracy = Math.round(((correct + partial * 0.5) / total) * 100);
    return <span className="accuracy-complete">{accuracy}% accuracy</span>;
  };

  return (
    <div className="runs-page">
      <div className="page-header">
        <h2>Runs</h2>
      </div>

      {/* Active Run Progress */}
      {activeRun && activeRun.status !== 'completed' && (
        <div className="active-run-panel">
          <div className="active-run-header">
            <h3>
              {activeRun.status === 'starting'
                ? 'Starting run...'
                : activeRun.status === 'running'
                ? 'Running test...'
                : 'Run failed'}
            </h3>
            {activeRun.status === 'running' && (
              <span className="result-count">
                {activeRun.results.length} results
              </span>
            )}
          </div>
          {activeRun.error && (
            <div className="run-error">{activeRun.error}</div>
          )}
          {activeRun.status === 'running' && (
            <div className="active-run-results">
              {activeRun.results.slice(-3).map((result, idx) => (
                <div key={idx} className="result-preview">
                  <span className="result-q">Q: {result.question.slice(0, 50)}...</span>
                  {result.isError ? (
                    <span className="result-error">Error</span>
                  ) : (
                    <span className="result-a">A: {result.answer.slice(0, 50)}...</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Runs List */}
      <div className="runs-list">
        {runs.length === 0 ? (
          <div className="empty-state">
            <p>No runs yet</p>
            <p className="empty-hint">
              Run a test from the Tests page to see results here
            </p>
          </div>
        ) : (
          runs.map((run) => (
            <div key={run.id} className="run-card">
              <div className="run-header">
                <div className="run-info">
                  <h3>{run.test?.name || 'Unknown Test'}</h3>
                  <span className={`status-badge ${STATUS_BADGES[run.status]?.className}`}>
                    {STATUS_BADGES[run.status]?.label}
                  </span>
                </div>
                <div className="run-actions">
                  <button
                    className="view-btn"
                    onClick={() => handleViewRun(run.id)}
                  >
                    {run.status === 'completed' ? 'Evaluate' : 'View'}
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => setDeleteConfirm({ open: true, id: run.id })}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="run-details">
                <div className="detail-row">
                  <span className="detail-label">Started:</span>
                  <span className="detail-value">
                    {run.startedAt ? formatDate(run.startedAt) : formatDate(run.createdAt)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Questions:</span>
                  <span className="detail-value">
                    {run.completedQuestions}/{run.totalQuestions}
                  </span>
                </div>
                {run.status === 'completed' && (
                  <div className="detail-row">
                    <span className="detail-label">Evaluation:</span>
                    {getAccuracyDisplay(run)}
                  </div>
                )}
                {run.status === 'failed' && run.errorMessage && (
                  <div className="detail-row error">
                    <span className="detail-label">Error:</span>
                    <span className="detail-value">{run.errorMessage}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Run"
        message="Are you sure you want to delete this run? All evaluation data will be lost."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
