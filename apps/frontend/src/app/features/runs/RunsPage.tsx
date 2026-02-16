import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StoredRun, RunStatus, StoredTest, RunsSortField, SortDirection } from '@agent-eval/shared';
import { ConfirmDialog, Pagination, FilterBar, FilterDefinition, SortOption, ActiveFilter } from '@agent-eval/ui';
import { useNotification } from '../../context/NotificationContext';
import { apiClient } from '../../apiClient';
import { downloadExportBundle, downloadAuthenticatedFile, generateExportFilename } from '../../shared/exportImportUtils';
import styles from './runs.module.scss';

type RunStatusBadge = {
  [key: string]: { label: string; className: string };
};

const STATUS_BADGES: RunStatusBadge = {
  pending: { label: 'Pending', className: styles.badgePending },
  running: { label: 'Running', className: styles.badgeRunning },
  completed: { label: 'Completed', className: styles.badgeCompleted },
  failed: { label: 'Failed', className: styles.badgeFailed },
  canceled: { label: 'Canceled', className: styles.badgeCanceled },
};

export function RunsPage() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [tests, setTests] = useState<StoredTest[]>([]);
  const [cancelConfirm, setCancelConfirm] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });
  const [exportMenuOpen, setExportMenuOpen] = useState<string | null>(null);

  // Filter and pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Sorting state
  const [sortBy, setSortBy] = useState<RunsSortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
      search: searchTerm || undefined,
      testId: filters.test || undefined,
      runId: filters.runId || undefined,
      status: (filters.status as RunStatus) || undefined,
      sortBy,
      sortDirection,
    });

    if (response.success && response.data) {
      setRuns(response.data.data);
      setTotalItems(response.data.pagination.total);
      setTotalPages(response.data.pagination.totalPages);

      // Check if any runs are still running
      hasRunningRunsRef.current = response.data.data.some((r) => r.status === 'running' || r.status === 'pending');
    }
    setIsLoading(false);
  }, [currentPage, itemsPerPage, searchTerm, filters, sortBy, sortDirection]);

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

  // Close export menu on outside click
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = () => setExportMenuOpen(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [exportMenuOpen]);

  // Filter definitions for FilterBar
  const filterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        key: 'test',
        label: 'Test',
        type: 'select',
        options: tests.map((test) => ({
          value: test.id,
          label: test.name,
          sublabel: test.flowConfig?.flowId,
        })),
      },
      {
        key: 'runId',
        label: 'Run ID',
        type: 'text',
        placeholder: 'Enter run ID...',
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'pending', label: 'Pending' },
          { value: 'running', label: 'Running' },
          { value: 'completed', label: 'Completed' },
          { value: 'failed', label: 'Failed' },
          { value: 'canceled', label: 'Canceled' },
        ],
      },
    ],
    [tests]
  );

  const sortOptions: SortOption[] = [
    { value: 'createdAt', label: 'Date Created' },
    { value: 'startedAt', label: 'Date Started' },
    { value: 'completedAt', label: 'Date Completed' },
    { value: 'status', label: 'Status' },
  ];

  // Build active filters array for FilterBar
  const activeFilters: ActiveFilter[] = useMemo(() => {
    const result: ActiveFilter[] = [];
    if (filters.test) {
      const test = tests.find((t) => t.id === filters.test);
      result.push({
        key: 'test',
        value: filters.test,
        label: 'Test',
        displayValue: test?.name || 'Unknown',
      });
    }
    if (filters.runId) {
      result.push({
        key: 'runId',
        value: filters.runId,
        label: 'Run ID',
        displayValue: filters.runId,
      });
    }
    if (filters.status) {
      result.push({
        key: 'status',
        value: filters.status,
        label: 'Status',
        displayValue: filters.status.charAt(0).toUpperCase() + filters.status.slice(1),
      });
    }
    return result;
  }, [filters, tests]);

  const handleFilterAdd = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleFilterRemove = (key: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({});
    setSortBy('createdAt');
    setSortDirection('desc');
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handleCancel = async () => {
    if (!cancelConfirm.id) return;
    const response = await apiClient.cancelRun(cancelConfirm.id);
    setCancelConfirm({ open: false, id: null });
    if (response.success) {
      loadRuns();
      showNotification('success', 'Run canceled successfully');
    } else {
      showNotification('error', response.error || 'Failed to cancel run');
    }
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
    const evaluated = run.results.filter((r) => r.humanEvaluation && !r.isError).length;
    const total = run.results.filter((r) => !r.isError).length;
    if (evaluated === 0) return <span className={styles.accuracyPending}>Not evaluated</span>;
    if (evaluated < total)
      return (
        <span className={styles.accuracyPartial}>
          {evaluated}/{total} evaluated
        </span>
      );

    const correct = run.results.filter((r) => r.humanEvaluation === 'correct').length;
    const partial = run.results.filter((r) => r.humanEvaluation === 'partial').length;
    const accuracy = Math.round(((correct + partial * 0.5) / total) * 100);
    return <span className={styles.accuracyComplete}>{accuracy}% accuracy</span>;
  };

  const hasActiveFilters = searchTerm || Object.keys(filters).length > 0;

  const handleExportJson = async (run: StoredRun) => {
    setExportMenuOpen(null);
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

  const handleExportCsv = async (run: StoredRun) => {
    setExportMenuOpen(null);
    const shortId = run.id.slice(0, 8);
    const date = new Date().toISOString().split('T')[0];
    const ok = await downloadAuthenticatedFile(
      apiClient.getRunExportCsvUrl(run.id),
      `run-${shortId}-${date}.csv`,
    );
    showNotification(ok ? 'success' : 'error', ok ? 'CSV exported' : 'Failed to export CSV');
  };

  const handleExportPdf = async (run: StoredRun) => {
    setExportMenuOpen(null);
    const shortId = run.id.slice(0, 8);
    const date = new Date().toISOString().split('T')[0];
    const ok = await downloadAuthenticatedFile(
      apiClient.getRunExportPdfUrl(run.id),
      `run-report-${shortId}-${date}.pdf`,
    );
    showNotification(ok ? 'success' : 'error', ok ? 'PDF exported' : 'Failed to export PDF');
  };

  return (
    <div className={styles.runsPage}>
      <div className={styles.pageHeader}>
        <h2>Runs</h2>
      </div>

      <FilterBar
        filters={filterDefinitions}
        activeFilters={activeFilters}
        onFilterAdd={handleFilterAdd}
        onFilterRemove={handleFilterRemove}
        onClearAll={clearFilters}
        searchValue={searchTerm}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search by test name..."
        sortOptions={sortOptions}
        sortValue={sortBy}
        sortDirection={sortDirection}
        onSortChange={(value) => {
          setSortBy(value as RunsSortField);
          setCurrentPage(1);
        }}
        onSortDirectionChange={(dir) => {
          setSortDirection(dir);
          setCurrentPage(1);
        }}
      />

      {/* Runs List */}
      <div className={styles.runsList}>
        {isLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <span className={styles.loadingText}>Loading runs...</span>
          </div>
        ) : totalItems === 0 && !hasActiveFilters ? (
          <div className={styles.emptyState}>
            <p>No runs yet</p>
            <p className={styles.emptyHint}>Run a test from the Tests page to see results here</p>
          </div>
        ) : totalItems === 0 && hasActiveFilters ? (
          <div className={styles.emptyState}>
            <p>No runs match your filters</p>
            <p className={styles.emptyHint}>Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          runs.map((run) => (
            <div key={run.id} className={styles.runCard}>
              <div className={styles.runHeader}>
                <div className={styles.runInfo}>
                  <h3>{run.test?.name || 'Unknown Test'}</h3>
                  <span className={`${styles.statusBadge} ${STATUS_BADGES[run.status]?.className}`}>{STATUS_BADGES[run.status]?.label}</span>
                  {run.test?.type === 'conversation' && (
                    <span className={styles.runTypeBadge}>Conversation</span>
                  )}
                  {run.test?.type === 'qa' && (
                    <span className={styles.runTypeBadge}>Q&A</span>
                  )}
                </div>
                <div className={styles.runActions}>
                  <button className={styles.viewBtn} onClick={() => handleViewRun(run.id)}>
                    {run.status === 'completed' ? 'Evaluate' : 'View'}
                  </button>
                  <div className={styles.exportDropdown} onClick={(e) => e.stopPropagation()}>
                    <button
                      className={styles.exportBtn}
                      onClick={() => setExportMenuOpen((prev) => prev === run.id ? null : run.id)}
                    >
                      Export &#9662;
                    </button>
                    {exportMenuOpen === run.id && (
                      <div className={styles.exportMenu}>
                        <button onClick={() => handleExportJson(run)}>Export JSON</button>
                        <button onClick={() => handleExportCsv(run)}>Export CSV</button>
                        <button onClick={() => handleExportPdf(run)}>Export PDF</button>
                      </div>
                    )}
                  </div>
                  {(run.status === 'running' || run.status === 'pending') && (
                    <button className={styles.cancelBtn} onClick={() => setCancelConfirm({ open: true, id: run.id })}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              <div className={styles.runDetails}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Run ID:</span>
                  <span className={`${styles.detailValue} ${styles.runIdValue}`}>{run.id}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Started:</span>
                  <span className={styles.detailValue}>{run.startedAt ? formatDate(run.startedAt) : formatDate(run.createdAt)}</span>
                </div>
                {run.completedAt && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Ended:</span>
                    <span className={styles.detailValue}>{formatDate(run.completedAt)}</span>
                  </div>
                )}
                {formatDuration(run.startedAt, run.completedAt) && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Duration:</span>
                    <span className={styles.detailValue}>{formatDuration(run.startedAt, run.completedAt)}</span>
                  </div>
                )}
                {run.test?.type === 'conversation' ? (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Scenarios:</span>
                    <span className={styles.detailValue}>
                      {run.completedScenarios ?? 0}/{run.totalScenarios ?? 0}
                    </span>
                  </div>
                ) : (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Questions:</span>
                    <span className={styles.detailValue}>
                      {run.completedQuestions}/{run.totalQuestions}
                    </span>
                  </div>
                )}
                {run.status === 'completed' && run.test?.type !== 'conversation' && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Evaluation:</span>
                    {getAccuracyDisplay(run)}
                  </div>
                )}
                {run.status === 'failed' && run.errorMessage && (
                  <div className={`${styles.detailRow} ${styles.error}`}>
                    <span className={styles.detailLabel}>Error:</span>
                    <span className={styles.detailValue}>{run.errorMessage}</span>
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
