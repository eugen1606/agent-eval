import React, { useEffect, useState } from 'react';
import { StoredWebhook, WebhookEvent } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { Modal, ConfirmDialog, AlertDialog } from './Modal';

const apiClient = new AgentEvalClient();

const EVENT_LABELS: Record<WebhookEvent, string> = {
  'evaluation.completed': 'Evaluation Completed',
  'scheduled.completed': 'Scheduled Evaluation Completed',
  'scheduled.failed': 'Scheduled Evaluation Failed',
};

export function WebhooksManager() {
  const [webhooks, setWebhooks] = useState<StoredWebhook[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
    events: [] as WebhookEvent[],
    secret: '',
  });
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [testResult, setTestResult] = useState<{ open: boolean; success: boolean; message: string }>({ open: false, success: false, message: '' });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    const response = await apiClient.getWebhooks();
    if (response.success && response.data) {
      setWebhooks(response.data);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.name || !formData.url || formData.events.length === 0) {
      setFormError('Name, URL, and at least one event are required');
      return;
    }

    setLoading(true);
    setFormError(null);

    try {
      let response;
      if (editingId) {
        response = await apiClient.updateWebhook(editingId, {
          name: formData.name,
          url: formData.url,
          description: formData.description || undefined,
          events: formData.events,
          secret: formData.secret || undefined,
        });
      } else {
        response = await apiClient.createWebhook({
          name: formData.name,
          url: formData.url,
          description: formData.description || undefined,
          events: formData.events,
          secret: formData.secret || undefined,
        });
      }

      if (response.success) {
        resetForm();
        loadWebhooks();
      } else {
        setFormError(response.error || 'Failed to save webhook');
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save webhook');
    }
    setLoading(false);
  };

  const handleEdit = (webhook: StoredWebhook) => {
    setEditingId(webhook.id);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      description: webhook.description || '',
      events: webhook.events,
      secret: webhook.secret || '',
    });
    setShowForm(true);
    setFormError(null);
  };

  const resetForm = () => {
    setFormData({ name: '', url: '', description: '', events: [], secret: '' });
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    await apiClient.deleteWebhook(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    loadWebhooks();
  };

  const handleToggle = async (id: string) => {
    const response = await apiClient.toggleWebhook(id);
    if (response.success) {
      loadWebhooks();
    }
  };

  const handleTest = async (id: string) => {
    const response = await apiClient.testWebhook(id);
    if (response.success && response.data) {
      setTestResult({ open: true, success: response.data.success, message: response.data.message });
    } else {
      setTestResult({ open: true, success: false, message: response.error || 'Test failed' });
    }
  };

  const toggleEvent = (event: WebhookEvent) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h3>Webhooks</h3>
        <button onClick={() => setShowForm(true)}>
          + Add Webhook
        </button>
      </div>

      <Modal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        title={editingId ? 'Edit Webhook' : 'Add Webhook'}
        footer={
          <>
            <button className="modal-btn cancel" onClick={resetForm}>
              Cancel
            </button>
            <button
              className="modal-btn confirm"
              onClick={() => handleSubmit()}
              disabled={loading || !formData.name || !formData.url || formData.events.length === 0}
            >
              {loading ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Webhook Name</label>
            <input
              type="text"
              placeholder="My Integration"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Webhook URL</label>
            <input
              type="url"
              placeholder="https://example.com/webhook"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Events</label>
            <div className="events-list">
              {(Object.keys(EVENT_LABELS) as WebhookEvent[]).map((event) => (
                <label key={event} className="event-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.events.includes(event)}
                    onChange={() => toggleEvent(event)}
                  />
                  {EVENT_LABELS[event]}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Secret (optional)</label>
            <input
              type="text"
              placeholder="Shared secret for signature verification"
              value={formData.secret}
              onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
            />
            <span className="form-hint">Used to sign webhook payloads with HMAC-SHA256</span>
          </div>
          <div className="form-group">
            <label>Description (optional)</label>
            <input
              type="text"
              placeholder="What this webhook is used for"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          {formError && <span className="error">{formError}</span>}
        </form>
      </Modal>

      <div className="manager-list">
        {webhooks.length === 0 ? (
          <p className="empty-message">No webhooks configured</p>
        ) : (
          webhooks.map((webhook) => (
            <div key={webhook.id} className="manager-item">
              <div className="item-info">
                <strong>{webhook.name}</strong>
                <span className={`status-badge ${webhook.enabled ? 'status-completed' : 'status-pending'}`}>
                  {webhook.enabled ? 'Enabled' : 'Disabled'}
                </span>
                <span className="item-meta">{webhook.url}</span>
                {webhook.description && <span className="item-desc">{webhook.description}</span>}
                <div className="webhook-events">
                  {webhook.events.map((event) => (
                    <span key={event} className="event-badge">{EVENT_LABELS[event]}</span>
                  ))}
                </div>
              </div>
              <div className="item-actions">
                <button onClick={() => handleTest(webhook.id)} className="test-btn">
                  Test
                </button>
                <button onClick={() => handleToggle(webhook.id)} className="toggle-btn">
                  {webhook.enabled ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => handleEdit(webhook)} className="edit-btn">
                  Edit
                </button>
                <button onClick={() => setDeleteConfirm({ open: true, id: webhook.id })} className="delete-btn">
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
        title="Delete Webhook"
        message="Are you sure you want to delete this webhook? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />

      <AlertDialog
        isOpen={testResult.open}
        onClose={() => setTestResult({ open: false, success: false, message: '' })}
        title={testResult.success ? 'Test Successful' : 'Test Failed'}
        message={testResult.message}
      />
    </div>
  );
}
