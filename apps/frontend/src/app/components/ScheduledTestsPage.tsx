import React, { useEffect, useState } from 'react';
import { StoredScheduledTest, StoredTest, ScheduleType } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { Modal, ConfirmDialog } from './Modal';
import { SearchableSelect } from './SearchableSelect';
import { useNavigate } from 'react-router-dom';

const apiClient = new AgentEvalClient();

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
  const [scheduledTests, setScheduledTests] = useState<StoredScheduledTest[]>([]);
  const [tests, setTests] = useState<StoredTest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [scheduledRes, testsRes] = await Promise.all([
      apiClient.getScheduledTests(),
      apiClient.getTests({ limit: 100 }),
    ]);

    if (scheduledRes.success && scheduledRes.data) {
      setScheduledTests(scheduledRes.data);
    }
    if (testsRes.success && testsRes.data) {
      setTests(testsRes.data.data);
    }
    setIsLoading(false);
  };

  const isFormValid = () => {
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
    if (!isFormValid()) return;

    setLoading(true);

    const cronExpression = formData.scheduleType === 'cron'
      ? (formData.cronPreset === 'custom' ? formData.cronExpression : formData.cronPreset)
      : undefined;

    const payload = {
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
    }
    setLoading(false);
  };

  const handleEdit = (scheduled: StoredScheduledTest) => {
    setEditingId(scheduled.id);

    let cronPreset = '0 0 * * *';
    if (scheduled.cronExpression) {
      const found = CRON_PRESETS.find(p => p.value === scheduled.cronExpression);
      cronPreset = found ? scheduled.cronExpression : 'custom';
    }

    setFormData({
      testId: scheduled.testId,
      scheduleType: scheduled.scheduleType || 'once',
      scheduledAt: scheduled.scheduledAt ? scheduled.scheduledAt.slice(0, 16) : '',
      cronPreset,
      cronExpression: cronPreset === 'custom' ? (scheduled.cronExpression || '') : '',
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      testId: '',
      scheduleType: 'once',
      scheduledAt: '',
      cronPreset: '0 0 * * *',
      cronExpression: '',
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    await apiClient.deleteScheduledTest(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    loadData();
  };

  const handleExecuteNow = async (id: string) => {
    setLoading(true);
    const result = await apiClient.executeScheduledTestNow(id);
    if (result.success) {
      setTimeout(() => loadData(), 1000);
    }
    setLoading(false);
  };

  const handleViewResult = (runId: string) => {
    navigate(`/runs/${runId}`);
  };

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      pending: 'badge-pending',
      running: 'badge-running',
      completed: 'badge-completed',
      failed: 'badge-failed',
    };
    return <span className={`status-badge ${statusClasses[status] || ''}`}>{status}</span>;
  };

  const getTestName = (testId: string) => {
    const test = tests.find(t => t.id === testId);
    return test ? test.name : 'Unknown';
  };

  const getTestDetails = (testId: string) => {
    const test = tests.find(t => t.id === testId);
    return test ? `${test.flowId}` : '';
  };

  const openNewForm = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const defaultTime = now.toISOString().slice(0, 16);
    setFormData({
      ...formData,
      scheduledAt: defaultTime,
      scheduleType: 'once',
    });
    setShowForm(true);
  };

  const getScheduleDisplay = (scheduled: StoredScheduledTest) => {
    if (scheduled.scheduleType === 'cron' && scheduled.cronExpression) {
      const preset = CRON_PRESETS.find(p => p.value === scheduled.cronExpression);
      return `Recurring: ${preset ? preset.label : scheduled.cronExpression}`;
    }
    if (scheduled.scheduledAt) {
      return `Once: ${new Date(scheduled.scheduledAt).toLocaleString()}`;
    }
    return 'Not scheduled';
  };

  return (
    <div className="scheduled-tests-page">
      <div className="page-header">
        <h2>Scheduled Tests</h2>
        <button onClick={openNewForm} className="primary-btn">
          + Schedule Test
        </button>
      </div>

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
            <button
              className="modal-btn confirm"
              onClick={() => handleSubmit()}
              disabled={loading || !isFormValid()}
            >
              {loading ? 'Saving...' : editingId ? 'Update' : 'Schedule'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Test</label>
            <SearchableSelect
              value={formData.testId}
              onChange={(value) => setFormData({ ...formData, testId: value })}
              options={tests.map((test) => ({
                value: test.id,
                label: test.name,
                sublabel: test.flowId,
              }))}
              placeholder="Search tests..."
              allOptionLabel="Select a test..."
            />
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
              <label>Scheduled Time</label>
              <input
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
              />
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
                  <label>Cron Expression</label>
                  <input
                    type="text"
                    placeholder="* * * * * (min hour day month weekday)"
                    value={formData.cronExpression}
                    onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                  />
                  <span className="input-hint">Format: minute hour day month weekday</span>
                </div>
              )}
            </>
          )}
        </form>
      </Modal>

      <div className="scheduled-list">
        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <span className="loading-text">Loading scheduled tests...</span>
          </div>
        ) : scheduledTests.length === 0 ? (
          <div className="empty-state">
            <p>No scheduled tests</p>
            <p className="empty-hint">Schedule a test to run automatically at a specific time</p>
          </div>
        ) : (
          scheduledTests.map((scheduled) => (
            <div key={scheduled.id} className="scheduled-card">
              <div className="scheduled-header">
                <div className="scheduled-info">
                  <h3>{getTestName(scheduled.testId)}</h3>
                  <span className="scheduled-flow">{getTestDetails(scheduled.testId)}</span>
                </div>
                <div className="scheduled-badges">
                  {getStatusBadge(scheduled.status)}
                  {scheduled.scheduleType === 'cron' && (
                    <span className="cron-badge">Recurring</span>
                  )}
                </div>
              </div>
              <div className="scheduled-details">
                <div className="detail-row">
                  <span className="detail-label">Schedule:</span>
                  <span className="detail-value">{getScheduleDisplay(scheduled)}</span>
                </div>
                {scheduled.lastRunAt && (
                  <div className="detail-row">
                    <span className="detail-label">Last run:</span>
                    <span className="detail-value">{new Date(scheduled.lastRunAt).toLocaleString()}</span>
                  </div>
                )}
                {scheduled.errorMessage && (
                  <div className="detail-row error">
                    <span className="detail-label">Error:</span>
                    <span className="detail-value">{scheduled.errorMessage}</span>
                  </div>
                )}
              </div>
              <div className="scheduled-actions">
                {(scheduled.status === 'pending' || scheduled.scheduleType === 'cron') && (
                  <button
                    onClick={() => handleExecuteNow(scheduled.id)}
                    className="run-now-btn"
                    disabled={loading || scheduled.status === 'running'}
                  >
                    Run Now
                  </button>
                )}
                {scheduled.status === 'completed' && scheduled.resultRunId && (
                  <button
                    onClick={() => handleViewResult(scheduled.resultRunId!)}
                    className="view-btn"
                  >
                    View Result
                  </button>
                )}
                <button onClick={() => handleEdit(scheduled)} className="edit-btn">
                  Edit
                </button>
                <button
                  onClick={() => setDeleteConfirm({ open: true, id: scheduled.id })}
                  className="delete-btn"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

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
