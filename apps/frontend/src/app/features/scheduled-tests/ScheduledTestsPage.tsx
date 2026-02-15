import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StoredScheduledTest,
  StoredTest,
  ScheduleType,
  ScheduledTestStatus,
  ScheduledTestsSortField,
  SortDirection,
} from '@agent-eval/shared';
import { Modal, ConfirmDialog } from '../../components/Modal';
import { FilterBar, FilterDefinition, SortOption, ActiveFilter } from '../../components/FilterBar';
import { Pagination } from '../../components/Pagination';
import { SearchableSelect } from '../../components/SearchableSelect';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../context/NotificationContext';
import { apiClient } from '../../apiClient';
import styles from './scheduled-tests.module.scss';

const CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 2 hours', value: '0 */2 * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 9 AM', value: '0 9 * * *' },
  { label: 'Weekly (Sunday)', value: '0 0 * * 0' },
  { label: 'Custom', value: 'custom' },
];

export function ScheduledTestsPage() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [scheduledTests, setScheduledTests] = useState<StoredScheduledTest[]>([]);
  const [tests, setTests] = useState<StoredTest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    testId: '',
    scheduleType: 'once' as ScheduleType,
    scheduledAt: '',
    cronPreset: '0 0 * * *',
    cronExpression: '',
  });
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Sorting state
  const [sortBy, setSortBy] = useState<ScheduledTestsSortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [scheduledRes, testsRes] = await Promise.all([
      apiClient.getScheduledTests({
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery || undefined,
        testId: filters.test || undefined,
        status: (filters.status as ScheduledTestStatus) || undefined,
        sortBy,
        sortDirection,
      }),
      apiClient.getTests({ limit: 100 }),
    ]);

    if (scheduledRes.success && scheduledRes.data) {
      setScheduledTests(scheduledRes.data.data);
      setTotalPages(scheduledRes.data.pagination.totalPages);
      setTotalItems(scheduledRes.data.pagination.total);
    }
    if (testsRes.success && testsRes.data) {
      setTests(testsRes.data.data);
    }
    setIsLoading(false);
  }, [currentPage, itemsPerPage, searchQuery, filters, sortBy, sortDirection]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, itemsPerPage, sortBy, sortDirection]);

  const isFormValid = () => {
    if (!formData.name.trim()) return false;
    if (!formData.testId) return false;
    if (formData.scheduleType === 'once' && !formData.scheduledAt) return false;
    if (formData.scheduleType === 'cron') {
      const cron = formData.cronPreset === 'custom' ? formData.cronExpression : formData.cronPreset;
      if (!cron) return false;
    }
    return true;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormSubmitAttempted(true);
    if (!isFormValid()) return;

    setLoading(true);

    const cronExpression =
      formData.scheduleType === 'cron'
        ? formData.cronPreset === 'custom'
          ? formData.cronExpression
          : formData.cronPreset
        : undefined;

    const payload = {
      name: formData.name.trim(),
      testId: formData.testId,
      scheduleType: formData.scheduleType,
      scheduledAt: formData.scheduleType === 'once' ? formData.scheduledAt : undefined,
      cronExpression,
    };

    let response;
    if (editingId) {
      response = await apiClient.updateScheduledTest(editingId, payload);
    } else {
      response = await apiClient.createScheduledTest(payload);
    }

    if (response.success) {
      resetForm();
      loadData();
      showNotification(
        'success',
        editingId ? 'Scheduled test updated successfully' : 'Scheduled test created successfully'
      );
    } else {
      showNotification('error', response.error || 'Failed to save scheduled test');
    }
    setLoading(false);
  };

  const handleEdit = (scheduled: StoredScheduledTest) => {
    setEditingId(scheduled.id);

    let cronPreset = '0 0 * * *';
    if (scheduled.cronExpression) {
      const found = CRON_PRESETS.find((p) => p.value === scheduled.cronExpression);
      cronPreset = found ? scheduled.cronExpression : 'custom';
    }

    setFormData({
      name: scheduled.name || '',
      testId: scheduled.testId,
      scheduleType: scheduled.scheduleType || 'once',
      scheduledAt: scheduled.scheduledAt ? scheduled.scheduledAt.slice(0, 16) : '',
      cronPreset,
      cronExpression: cronPreset === 'custom' ? scheduled.cronExpression || '' : '',
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      testId: '',
      scheduleType: 'once',
      scheduledAt: '',
      cronPreset: '0 0 * * *',
      cronExpression: '',
    });
    setShowForm(false);
    setEditingId(null);
    setFormSubmitAttempted(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    const response = await apiClient.deleteScheduledTest(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    if (response.success) {
      loadData();
      showNotification('success', 'Scheduled test deleted successfully');
    } else {
      showNotification('error', response.error || 'Failed to delete scheduled test');
    }
  };

  const handleExecuteNow = async (id: string) => {
    setLoading(true);
    const result = await apiClient.executeScheduledTestNow(id);
    if (result.success) {
      setTimeout(() => loadData(), 1000);
      showNotification('success', 'Test execution started');
    } else {
      showNotification('error', result.error || 'Failed to execute test');
    }
    setLoading(false);
  };

  const handleViewResult = (runId: string) => {
    navigate(`/runs/${runId}`);
  };

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      pending: styles.badgePending,
      running: styles.badgeRunning,
      completed: styles.badgeCompleted,
      failed: styles.badgeFailed,
    };
    return <span className={`${styles.statusBadge} ${statusClasses[status] || ''}`}>{status}</span>;
  };

  const getTestName = (testId: string) => {
    const test = tests.find((t) => t.id === testId);
    return test ? test.name : 'Unknown';
  };

  const openNewForm = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const defaultTime = now.toISOString().slice(0, 16);
    setFormData({
      ...formData,
      name: '',
      testId: '',
      scheduledAt: defaultTime,
      scheduleType: 'once',
    });
    setShowForm(true);
  };

  const getScheduleDisplay = (scheduled: StoredScheduledTest) => {
    if (scheduled.scheduleType === 'cron' && scheduled.cronExpression) {
      const preset = CRON_PRESETS.find((p) => p.value === scheduled.cronExpression);
      return `Recurring: ${preset ? preset.label : scheduled.cronExpression}`;
    }
    if (scheduled.scheduledAt) {
      return `Once: ${new Date(scheduled.scheduledAt).toLocaleString()}`;
    }
    return 'Not scheduled';
  };

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
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'pending', label: 'Pending' },
          { value: 'running', label: 'Running' },
          { value: 'completed', label: 'Completed' },
          { value: 'failed', label: 'Failed' },
        ],
      },
    ],
    [tests]
  );

  const sortOptions: SortOption[] = [
    { value: 'createdAt', label: 'Date Created' },
    { value: 'name', label: 'Name' },
    { value: 'scheduledAt', label: 'Scheduled Time' },
    { value: 'lastRunAt', label: 'Last Run' },
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
  };

  const handleFilterRemove = (key: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilters({});
    setSortBy('createdAt');
    setSortDirection('desc');
  };

  const hasActiveFilters = searchQuery || Object.keys(filters).length > 0;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
  };

  return (
    <div className={styles.scheduledTestsPage}>
      <div className={styles.pageHeader}>
        <h2>Scheduled Tests</h2>
        <button onClick={openNewForm} className={styles.primaryBtn}>
          + Schedule Test
        </button>
      </div>

      <FilterBar
        filters={filterDefinitions}
        activeFilters={activeFilters}
        onFilterAdd={handleFilterAdd}
        onFilterRemove={handleFilterRemove}
        onClearAll={clearFilters}
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search by name..."
        sortOptions={sortOptions}
        sortValue={sortBy}
        sortDirection={sortDirection}
        onSortChange={(value) => setSortBy(value as ScheduledTestsSortField)}
        onSortDirectionChange={setSortDirection}
      />

      <Modal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        title={editingId ? 'Edit Scheduled Test' : 'Schedule New Test'}
        footer={
          <>
            <button className="modal-btn cancel" onClick={resetForm}>
              Cancel
            </button>
            <button className="modal-btn confirm" onClick={() => handleSubmit()} disabled={loading}>
              {loading ? 'Saving...' : editingId ? 'Update' : 'Schedule'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              placeholder="Give this scheduled test a name..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={formSubmitAttempted && !formData.name.trim() ? 'input-error' : ''}
            />
            {formSubmitAttempted && !formData.name.trim() && (
              <span className="field-error">Name is required</span>
            )}
          </div>

          <div className="form-group">
            <label>Test *</label>
            <SearchableSelect
              value={formData.testId}
              onChange={(value) => setFormData({ ...formData, testId: value })}
              options={tests.map((test) => ({
                value: test.id,
                label: test.name,
                sublabel: test.flowConfig?.flowId,
              }))}
              placeholder="Search tests..."
              allOptionLabel="Select a test..."
            />
            {formSubmitAttempted && !formData.testId && (
              <span className="field-error">Please select a test</span>
            )}
          </div>

          <div className="form-group">
            <label>Schedule Type</label>
            <div className="toggle-group schedule-toggle">
              <button
                type="button"
                className={formData.scheduleType === 'once' ? 'active' : ''}
                onClick={() => setFormData({ ...formData, scheduleType: 'once' })}
              >
                One-time
              </button>
              <button
                type="button"
                className={formData.scheduleType === 'cron' ? 'active' : ''}
                onClick={() => setFormData({ ...formData, scheduleType: 'cron' })}
              >
                Recurring
              </button>
            </div>
          </div>

          {formData.scheduleType === 'once' && (
            <div className="form-group">
              <label>Scheduled Time *</label>
              <input
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                className={formSubmitAttempted && !formData.scheduledAt ? 'input-error' : ''}
              />
              {formSubmitAttempted && !formData.scheduledAt && (
                <span className="field-error">Scheduled time is required</span>
              )}
            </div>
          )}

          {formData.scheduleType === 'cron' && (
            <>
              <div className="form-group">
                <label>Frequency</label>
                <select
                  value={formData.cronPreset}
                  onChange={(e) => setFormData({ ...formData, cronPreset: e.target.value })}
                >
                  {CRON_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
              {formData.cronPreset === 'custom' && (
                <div className="form-group">
                  <label>Cron Expression *</label>
                  <input
                    type="text"
                    placeholder="* * * * * (min hour day month weekday)"
                    value={formData.cronExpression}
                    onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                    className={formSubmitAttempted && !formData.cronExpression ? 'input-error' : ''}
                  />
                  <span className="input-hint">Format: minute hour day month weekday</span>
                  {formSubmitAttempted && !formData.cronExpression && (
                    <span className="field-error">Cron expression is required</span>
                  )}
                </div>
              )}
            </>
          )}
        </form>
      </Modal>

      <div className={styles.scheduledList}>
        {isLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <span className={styles.loadingText}>Loading scheduled tests...</span>
          </div>
        ) : scheduledTests.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No scheduled tests{hasActiveFilters ? ' match your filters' : ''}</p>
            <p className={styles.emptyHint}>
              {hasActiveFilters
                ? 'Try adjusting your filters or clear them'
                : 'Schedule a test to run automatically at a specific time'}
            </p>
          </div>
        ) : (
          scheduledTests.map((scheduled) => (
            <div key={scheduled.id} className={styles.scheduledCard}>
              <div className={styles.scheduledHeader}>
                <div className={styles.scheduledInfo}>
                  <h3>{scheduled.name || 'Unnamed'}</h3>
                  <span className={styles.scheduledTestName}>
                    <span className={styles.scheduledTestLabel}>Test:</span>{' '}
                    {getTestName(scheduled.testId)}
                  </span>
                </div>
                <div className={styles.scheduledBadges}>
                  {getStatusBadge(scheduled.status)}
                  {scheduled.scheduleType === 'cron' && (
                    <span className={styles.cronBadge}>Recurring</span>
                  )}
                </div>
              </div>
              <div className={styles.scheduledDetails}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Schedule:</span>
                  <span className={styles.detailValue}>{getScheduleDisplay(scheduled)}</span>
                </div>
                {scheduled.lastRunAt && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Last run:</span>
                    <span className={styles.detailValue}>
                      {new Date(scheduled.lastRunAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {scheduled.errorMessage && (
                  <div className={`${styles.detailRow} ${styles.error}`}>
                    <span className={styles.detailLabel}>Error:</span>
                    <span className={styles.detailValue}>{scheduled.errorMessage}</span>
                  </div>
                )}
              </div>
              <div className={styles.scheduledActions}>
                {(scheduled.status === 'pending' || scheduled.scheduleType === 'cron') && (
                  <button
                    onClick={() => handleExecuteNow(scheduled.id)}
                    className={styles.runNowBtn}
                    disabled={loading || scheduled.status === 'running'}
                  >
                    Run Now
                  </button>
                )}
                {scheduled.status === 'completed' && scheduled.resultRunId && (
                  <button
                    onClick={() => handleViewResult(scheduled.resultRunId!)}
                    className={styles.viewBtn}
                  >
                    View Result
                  </button>
                )}
                <button onClick={() => handleEdit(scheduled)} className={styles.editBtn}>
                  Edit
                </button>
                <button
                  onClick={() => setDeleteConfirm({ open: true, id: scheduled.id })}
                  className={styles.deleteBtn}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {!isLoading && scheduledTests.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
          itemName="scheduled tests"
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Scheduled Test"
        message="Are you sure you want to delete this scheduled test? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
