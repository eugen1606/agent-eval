import React, { useEffect, useState } from 'react';
import {
  StoredScheduledEvaluation,
  StoredAccessToken,
  StoredQuestionSet,
  StoredFlowConfig,
  ScheduleType,
} from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { Modal, ConfirmDialog } from './Modal';
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

export function ScheduledEvaluationsManager() {
  const navigate = useNavigate();
  const [scheduledEvaluations, setScheduledEvaluations] = useState<StoredScheduledEvaluation[]>([]);
  const [accessTokens, setAccessTokens] = useState<StoredAccessToken[]>([]);
  const [questionSets, setQuestionSets] = useState<StoredQuestionSet[]>([]);
  const [flowConfigs, setFlowConfigs] = useState<StoredFlowConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    accessTokenId: '',
    flowConfigId: '',
    questionSetId: '',
    scheduleType: 'once' as ScheduleType,
    scheduledAt: '',
    cronPreset: '0 0 * * *',
    cronExpression: '',
    multiStepEvaluation: false,
  });
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [scheduledRes, tokensRes, questionsRes, flowsRes] = await Promise.all([
      apiClient.getScheduledEvaluations(),
      apiClient.getAccessTokens(),
      apiClient.getQuestionSets(),
      apiClient.getFlowConfigs(),
    ]);

    if (scheduledRes.success && scheduledRes.data) {
      setScheduledEvaluations(scheduledRes.data);
    }
    if (tokensRes.success && tokensRes.data) {
      setAccessTokens(tokensRes.data);
    }
    if (questionsRes.success && questionsRes.data) {
      setQuestionSets(questionsRes.data);
    }
    if (flowsRes.success && flowsRes.data) {
      setFlowConfigs(flowsRes.data);
    }
  };

  const isFormValid = () => {
    if (!formData.name || !formData.accessTokenId || !formData.flowConfigId || !formData.questionSetId) {
      return false;
    }
    if (formData.scheduleType === 'once' && !formData.scheduledAt) {
      return false;
    }
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
      name: formData.name,
      description: formData.description || undefined,
      accessTokenId: formData.accessTokenId,
      flowConfigId: formData.flowConfigId,
      questionSetId: formData.questionSetId,
      scheduleType: formData.scheduleType,
      scheduledAt: formData.scheduleType === 'once' ? formData.scheduledAt : undefined,
      cronExpression,
      multiStepEvaluation: formData.multiStepEvaluation,
    };

    let response;
    if (editingId) {
      response = await apiClient.updateScheduledEvaluation(editingId, payload);
    } else {
      response = await apiClient.createScheduledEvaluation(payload);
    }

    if (response.success) {
      resetForm();
      loadData();
    }
    setLoading(false);
  };

  const handleEdit = (scheduled: StoredScheduledEvaluation) => {
    setEditingId(scheduled.id);

    // Determine cron preset
    let cronPreset = '0 0 * * *';
    if (scheduled.cronExpression) {
      const found = CRON_PRESETS.find(p => p.value === scheduled.cronExpression);
      cronPreset = found ? scheduled.cronExpression : 'custom';
    }

    setFormData({
      name: scheduled.name,
      description: scheduled.description || '',
      accessTokenId: scheduled.accessTokenId,
      flowConfigId: scheduled.flowConfigId,
      questionSetId: scheduled.questionSetId,
      scheduleType: scheduled.scheduleType || 'once',
      scheduledAt: scheduled.scheduledAt ? scheduled.scheduledAt.slice(0, 16) : '',
      cronPreset,
      cronExpression: cronPreset === 'custom' ? (scheduled.cronExpression || '') : '',
      multiStepEvaluation: scheduled.multiStepEvaluation,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      accessTokenId: '',
      flowConfigId: '',
      questionSetId: '',
      scheduleType: 'once',
      scheduledAt: '',
      cronPreset: '0 0 * * *',
      cronExpression: '',
      multiStepEvaluation: false,
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    await apiClient.deleteScheduledEvaluation(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    loadData();
  };

  const handleExecuteNow = async (id: string) => {
    setLoading(true);
    const result = await apiClient.executeScheduledEvaluationNow(id);
    if (result.success) {
      setTimeout(() => loadData(), 1000);
    }
    setLoading(false);
  };

  const handleReset = async (id: string) => {
    const result = await apiClient.resetScheduledEvaluation(id);
    if (result.success) {
      loadData();
    }
  };

  const handleViewResult = (evaluationId: string) => {
    navigate(`/dashboard?id=${evaluationId}`);
  };

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      pending: 'status-pending',
      running: 'status-running',
      completed: 'status-completed',
      failed: 'status-failed',
    };
    return <span className={`status-badge ${statusClasses[status] || ''}`}>{status}</span>;
  };

  const getTokenName = (id: string) => accessTokens.find(t => t.id === id)?.name || 'Unknown';
  const getQuestionSetName = (id: string) => questionSets.find(q => q.id === id)?.name || 'Unknown';
  const getFlowConfigName = (id: string) => flowConfigs.find(f => f.id === id)?.name || 'Unknown';

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

  const getScheduleDisplay = (scheduled: StoredScheduledEvaluation) => {
    if (scheduled.scheduleType === 'cron' && scheduled.cronExpression) {
      const preset = CRON_PRESETS.find(p => p.value === scheduled.cronExpression);
      return `Cron: ${preset ? preset.label : scheduled.cronExpression}`;
    }
    if (scheduled.scheduledAt) {
      return `Once: ${new Date(scheduled.scheduledAt).toLocaleString()}`;
    }
    return 'Not scheduled';
  };

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h3>Scheduled Evaluations</h3>
        <button onClick={openNewForm}>+ Schedule Evaluation</button>
      </div>

      <Modal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        title={editingId ? 'Edit Scheduled Evaluation' : 'Schedule New Evaluation'}
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
            <label>Name</label>
            <input
              type="text"
              placeholder="Enter evaluation name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Access Token</label>
            <select
              value={formData.accessTokenId}
              onChange={(e) => setFormData({ ...formData, accessTokenId: e.target.value })}
            >
              <option value="">Select access token...</option>
              {accessTokens.map((token) => (
                <option key={token.id} value={token.id}>
                  {token.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Flow Configuration</label>
            <select
              value={formData.flowConfigId}
              onChange={(e) => setFormData({ ...formData, flowConfigId: e.target.value })}
            >
              <option value="">Select flow config...</option>
              {flowConfigs.map((config) => (
                <option key={config.id} value={config.id}>
                  {config.name} ({config.flowId})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Question Set</label>
            <select
              value={formData.questionSetId}
              onChange={(e) => setFormData({ ...formData, questionSetId: e.target.value })}
            >
              <option value="">Select question set...</option>
              {questionSets.map((qs) => (
                <option key={qs.id} value={qs.id}>
                  {qs.name} ({qs.questions.length} questions)
                </option>
              ))}
            </select>
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
                Recurring (Cron)
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

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.multiStepEvaluation}
                onChange={(e) => setFormData({ ...formData, multiStepEvaluation: e.target.checked })}
              />
              Multi-step Evaluation
            </label>
            <span className="checkbox-hint">Use same session for all questions</span>
          </div>

          <div className="form-group">
            <label>Description (optional)</label>
            <input
              type="text"
              placeholder="Enter description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      <div className="manager-list">
        {scheduledEvaluations.length === 0 ? (
          <p className="empty-message">No scheduled evaluations</p>
        ) : (
          scheduledEvaluations.map((scheduled) => (
            <div key={scheduled.id} className="manager-item scheduled-item">
              <div className="item-info">
                <div className="item-header">
                  <strong>{scheduled.name}</strong>
                  {getStatusBadge(scheduled.status)}
                  {scheduled.scheduleType === 'cron' && (
                    <span className="cron-badge">Recurring</span>
                  )}
                </div>
                <div className="item-details">
                  <span>Token: {getTokenName(scheduled.accessTokenId)}</span>
                  <span>Flow: {getFlowConfigName(scheduled.flowConfigId)}</span>
                  <span>Questions: {getQuestionSetName(scheduled.questionSetId)}</span>
                </div>
                <div className="item-meta">
                  <span>{getScheduleDisplay(scheduled)}</span>
                  {scheduled.lastRunAt && (
                    <span>Last run: {new Date(scheduled.lastRunAt).toLocaleString()}</span>
                  )}
                  {scheduled.multiStepEvaluation && (
                    <span className="multi-step-badge">Multi-step</span>
                  )}
                </div>
                {scheduled.errorMessage && (
                  <div className="item-error">Error: {scheduled.errorMessage}</div>
                )}
                {scheduled.description && (
                  <span className="item-desc">{scheduled.description}</span>
                )}
              </div>
              <div className="item-actions">
                {(scheduled.status === 'pending' || scheduled.scheduleType === 'cron') && (
                  <button
                    onClick={() => handleExecuteNow(scheduled.id)}
                    className="execute-now-btn"
                    disabled={loading || scheduled.status === 'running'}
                  >
                    Run Now
                  </button>
                )}
                {scheduled.status === 'completed' && scheduled.resultEvaluationId && (
                  <button
                    onClick={() => handleViewResult(scheduled.resultEvaluationId!)}
                    className="view-result-btn"
                  >
                    View Result
                  </button>
                )}
                {scheduled.scheduleType === 'once' && (scheduled.status === 'completed' || scheduled.status === 'failed') && (
                  <button onClick={() => handleReset(scheduled.id)} className="reset-btn">
                    Reschedule
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
        title="Delete Scheduled Evaluation"
        message="Are you sure you want to delete this scheduled evaluation? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
