import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { StoredRun, RunStatus, StoredTest } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { ConfirmDialog } from './Modal';
import { Pagination } from './Pagination';
import { SearchableSelect } from './SearchableSelect';

const apiClient = new AgentEvalClient();

type RunStatusBadge = {
  [key: string]: { label: string; className: string };
};

const STATUS_BADGES: RunStatusBadge = {
  pending: { label: 'Pending', className: 'badge-pending' },
  running: { label: 'Running', className: 'badge-running' },
  completed: { label: 'Completed', className: 'badge-completed' },
  failed: { label: 'Failed', className: 'badge-failed' },
  canceled: { label: 'Canceled', className: 'badge-canceled' },
};

export function RunsPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [tests, setTests] = useState<StoredTest[]>([]);
  const [cancelConfirm, setCancelConfirm] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });

  // Filter and pagination state
  const [filterTestId, setFilterTestId] = useState('');
  const [filterStatus, setFilterStatus] = useState<RunStatus | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Track if there are running runs for auto-refresh
  const hasRunningRunsRef = useRef(false);

  // Load tests for the filter dropdown
  useEffect(() => {
    const loadTests = async () => {
      const response = await apiClient.getTests({ limit: 100 });
      if (response.success && response.data) {
        setTests(response.data.data);
      }
    };
    loadTests();
  }, []);

  // Load runs with filters and pagination
  const loadRuns = useCallback(async () => {
    setIsLoading(true);
    const response = await apiClient.getRuns({
      page: currentPage,
      limit: itemsPerPage,
      testId: filterTestId || undefined,
      status: filterStatus || undefined,
    });

    if (response.success && response.data) {
      setRuns(response.data.data);
      setTotalItems(response.data.pagination.total);
      setTotalPages(response.data.pagination.totalPages);

      // Check if any runs are still running
      hasRunningRunsRef.current = response.data.data.some(
        (r) => r.status === 'running' || r.status === 'pending'
      );
    }
    setIsLoading(false);
  }, [currentPage, itemsPerPage, filterTestId, filterStatus]);

  // Reload runs when filters or page changes
  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  // Auto-refresh when there are running runs
  useEffect(() => {
    if (!hasRunningRunsRef.current) return;

    const interval = setInterval(() => {
      if (hasRunningRunsRef.current) {
        loadRuns();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [loadRuns]);

  // Reset to page 1 when filters change
  const handleTestFilterChange = (value: string) => {
    setFilterTestId(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: RunStatus | '') => {
    setFilterStatus(value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilterTestId('');
    setFilterStatus('');
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handleCancel = async () => {
    if (!cancelConfirm.id) return;
    await apiClient.cancelRun(cancelConfirm.id);
    setCancelConfirm({ open: false, id: null });
    loadRuns();
  };

  const handleViewRun = (runId: string) => {
    navigate(`/runs/${runId}`);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt || !completedAt) return null;
    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();
    const durationMs = end - start;

    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    if (durationMs < 3600000) {
      const mins = Math.floor(durationMs / 60000);
      const secs = Math.floor((durationMs % 60000) / 1000);
      return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(durationMs / 3600000);
    const mins = Math.floor((durationMs % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  const getAccuracyDisplay = (run: StoredRun) => {
    if (run.status !== 'completed') return null;
    const evaluated = run.results.filter(
      (r) => r.humanEvaluation && !r.isError,
    ).length;
    const total = run.results.filter((r) => !r.isError).length;
    if (evaluated === 0)
      return <span className="accuracy-pending">Not evaluated</span>;
    if (evaluated < total)
      return (
        <span className="accuracy-partial">
          {evaluated}/{total} evaluated
        </span>
      );

    const correct = run.results.filter(
      (r) => r.humanEvaluation === 'correct',
    ).length;
    const partial = run.results.filter(
      (r) => r.humanEvaluation === 'partial',
    ).length;
    const accuracy = Math.round(((correct + partial * 0.5) / total) * 100);
    return <span className="accuracy-complete">{accuracy}% accuracy</span>;
  };

  const hasActiveFilters = filterTestId || filterStatus;

  return (
    <div className="runs-page">
      <div className="page-header">
        <h2>Runs</h2>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <SearchableSelect
            value={filterTestId}
            onChange={handleTestFilterChange}
            options={tests.map((test) => ({
              value: test.id,
              label: test.name,
              sublabel: test.flowId,
            }))}
            placeholder="Search tests..."
            allOptionLabel="All Tests"
          />
        </div>
        <div className="filter-group">
          <select
            value={filterStatus}
            onChange={(e) => handleStatusFilterChange(e.target.value as RunStatus | '')}
            className="filter-select"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>
        {hasActiveFilters && (
          <button
            className="filter-clear-btn"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Runs List */}
      <div className="runs-list">
        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <span className="loading-text">Loading runs...</span>
          </div>
        ) : totalItems === 0 && !hasActiveFilters ? (
          <div className="empty-state">
            <p>No runs yet</p>
            <p className="empty-hint">
              Run a test from the Tests page to see results here
            </p>
          </div>
        ) : totalItems === 0 && hasActiveFilters ? (
          <div className="empty-state">
            <p>No runs match your filters</p>
            <p className="empty-hint">
              Try adjusting your search or filter criteria
            </p>
          </div>
        ) : (
          runs.map((run) => (
            <div key={run.id} className="run-card">
              <div className="run-header">
                <div className="run-info">
                  <h3>{run.test?.name || 'Unknown Test'}</h3>
                  <span
                    className={`status-badge ${STATUS_BADGES[run.status]?.className}`}
                  >
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
                  {(run.status === 'running' || run.status === 'pending') && (
                    <button
                      className="cancel-btn"
                      onClick={() => setCancelConfirm({ open: true, id: run.id })}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              <div className="run-details">
                <div className="detail-row">
                  <span className="detail-label">Started:</span>
                  <span className="detail-value">
                    {run.startedAt
                      ? formatDate(run.startedAt)
                      : formatDate(run.createdAt)}
                  </span>
                </div>
                {run.completedAt && (
                  <div className="detail-row">
                    <span className="detail-label">Ended:</span>
                    <span className="detail-value">
                      {formatDate(run.completedAt)}
                    </span>
                  </div>
                )}
                {formatDuration(run.startedAt, run.completedAt) && (
                  <div className="detail-row">
                    <span className="detail-label">Duration:</span>
                    <span className="detail-value">
                      {formatDuration(run.startedAt, run.completedAt)}
                    </span>
                  </div>
                )}
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

      {totalPages > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={handleItemsPerPageChange}
          itemName="runs"
        />
      )}

      <ConfirmDialog
        isOpen={cancelConfirm.open}
        onClose={() => setCancelConfirm({ open: false, id: null })}
        onConfirm={handleCancel}
        title="Cancel Run"
        message="Are you sure you want to cancel this run? Progress will be saved but the run will be marked as failed."
        confirmText="Cancel Run"
        variant="danger"
      />
    </div>
  );
}
