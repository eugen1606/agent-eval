import React, { useEffect, useState } from 'react';
import { StoredWebhook, WebhookEvent, WebhookMethod, WebhookVariableDefinition } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { Modal, ConfirmDialog, AlertDialog } from './Modal';
import { useNotification } from '../context/NotificationContext';

const apiClient = new AgentEvalClient();

const EVENT_LABELS: Record<WebhookEvent, string> = {
  'run.running': 'Run Started',
  'run.completed': 'Run Completed',
  'run.failed': 'Run Failed',
  'run.evaluated': 'Run Evaluated',
};

const HTTP_METHODS: WebhookMethod[] = ['POST', 'PUT', 'PATCH'];

const DEFAULT_BODY_TEMPLATE = {
  event: '{{event}}',
  timestamp: '{{timestamp}}',
  run: {
    id: '{{runId}}',
    status: '{{runStatus}}',
    testId: '{{testId}}',
    testName: '{{testName}}',
  },
};

interface KeyValuePair {
  key: string;
  value: string;
}

function KeyValueEditor({
  pairs,
  onChange,
  label,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  supportsVariables = false,
}: {
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
  label: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  supportsVariables?: boolean;
}) {
  const addPair = () => {
    onChange([...pairs, { key: '', value: '' }]);
  };

  const removePair = (index: number) => {
    onChange(pairs.filter((_, i) => i !== index));
  };

  const updatePair = (index: number, field: 'key' | 'value', value: string) => {
    const newPairs = [...pairs];
    newPairs[index] = { ...newPairs[index], [field]: value };
    onChange(newPairs);
  };

  const labelText = label.replace(' (optional)', '');

  return (
    <div className="form-group">
      <div className="key-value-header">
        <label>{label}</label>
        <button type="button" onClick={addPair} className="add-kv-btn">
          + Add {labelText.toLowerCase().replace('s', '')}
        </button>
      </div>
      {supportsVariables && (
        <span className="form-hint">Supports {'{{variable}}'} syntax</span>
      )}
      <div className="key-value-editor">
        {pairs.map((pair, index) => (
          <div key={index} className="key-value-row">
            <input
              type="text"
              placeholder={keyPlaceholder}
              value={pair.key}
              onChange={(e) => updatePair(index, 'key', e.target.value)}
              className="key-input"
            />
            <input
              type="text"
              placeholder={valuePlaceholder}
              value={pair.value}
              onChange={(e) => updatePair(index, 'value', e.target.value)}
              className="value-input"
            />
            <button
              type="button"
              onClick={() => removePair(index)}
              className="remove-btn"
              title="Remove"
            >
              &times;
            </button>
          </div>
        ))}
        {pairs.length === 0 && (
          <div className="empty-kv-hint">No {labelText.toLowerCase()} configured</div>
        )}
      </div>
    </div>
  );
}

function VariableHelper({
  variables,
  selectedEvents,
  onInsert,
}: {
  variables: WebhookVariableDefinition[];
  selectedEvents: WebhookEvent[];
  onInsert: (variable: string) => void;
}) {
  const filteredVariables = variables.filter((v) =>
    v.events.some((e) => selectedEvents.includes(e))
  );

  if (filteredVariables.length === 0) {
    return (
      <div className="variable-helper">
        <div className="variable-helper-header">
          <span className="variable-helper-title">Available Variables</span>
        </div>
        <div className="variable-helper-empty">
          <p>Select events to see available variables</p>
        </div>
      </div>
    );
  }

  return (
    <div className="variable-helper">
      <div className="variable-helper-header">
        <span className="variable-helper-title">Available Variables</span>
        <span className="variable-helper-hint">Click to copy</span>
      </div>
      <div className="variable-list">
        {filteredVariables.map((v) => (
          <div
            key={v.name}
            className="variable-item"
            onClick={() => onInsert(`{{${v.name}}}`)}
          >
            <div className="variable-item-top">
              <code className="variable-name">{`{{${v.name}}}`}</code>
            </div>
            <div className="variable-item-bottom">
              <span className="variable-desc">{v.description}</span>
              <span className="variable-example">e.g. {v.example}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WebhooksManager() {
  const { showNotification } = useNotification();
  const [webhooks, setWebhooks] = useState<StoredWebhook[]>([]);
  const [variables, setVariables] = useState<WebhookVariableDefinition[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
    events: [] as WebhookEvent[],
    secret: '',
    method: 'POST' as WebhookMethod,
    headers: [] as KeyValuePair[],
    queryParams: [] as KeyValuePair[],
    bodyTemplate: JSON.stringify(DEFAULT_BODY_TEMPLATE, null, 2),
  });
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [testResult, setTestResult] = useState<{ open: boolean; success: boolean; message: string }>({ open: false, success: false, message: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);
  const [bodyTemplateError, setBodyTemplateError] = useState<string | null>(null);

  useEffect(() => {
    loadWebhooks();
    loadVariables();
  }, []);

  const loadWebhooks = async () => {
    setIsLoading(true);
    const response = await apiClient.getWebhooks();
    if (response.success && response.data) {
      setWebhooks(response.data);
    }
    setIsLoading(false);
  };

  const loadVariables = async () => {
    const response = await apiClient.getWebhookVariables();
    if (response.success && response.data) {
      setVariables(response.data.variables);
    }
  };

  const keyValuePairsToObject = (pairs: KeyValuePair[]): Record<string, string> => {
    const obj: Record<string, string> = {};
    for (const pair of pairs) {
      if (pair.key.trim()) {
        obj[pair.key.trim()] = pair.value;
      }
    }
    return obj;
  };

  const objectToKeyValuePairs = (obj: Record<string, string> | undefined): KeyValuePair[] => {
    if (!obj) return [];
    return Object.entries(obj).map(([key, value]) => ({ key, value }));
  };

  const validateBodyTemplate = (template: string): boolean => {
    try {
      const parsed = JSON.parse(template);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        setBodyTemplateError('Body template must be a JSON object');
        return false;
      }
      setBodyTemplateError(null);
      return true;
    } catch {
      setBodyTemplateError('Invalid JSON format');
      return false;
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormSubmitAttempted(true);

    if (!formData.name || !formData.url || formData.events.length === 0) {
      return;
    }

    if (!validateBodyTemplate(formData.bodyTemplate)) {
      return;
    }

    setLoading(true);
    setFormError(null);

    try {
      const headersObj = keyValuePairsToObject(formData.headers);
      const queryParamsObj = keyValuePairsToObject(formData.queryParams);
      const bodyTemplateObj = JSON.parse(formData.bodyTemplate);

      const payload = {
        name: formData.name,
        url: formData.url,
        description: formData.description || undefined,
        events: formData.events,
        secret: formData.secret || undefined,
        method: formData.method,
        headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
        queryParams: Object.keys(queryParamsObj).length > 0 ? queryParamsObj : undefined,
        bodyTemplate: bodyTemplateObj,
      };

      let response;
      if (editingId) {
        response = await apiClient.updateWebhook(editingId, payload);
      } else {
        response = await apiClient.createWebhook(payload);
      }

      if (response.success) {
        resetForm();
        loadWebhooks();
        showNotification('success', editingId ? 'Webhook updated successfully' : 'Webhook created successfully');
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
      method: webhook.method || 'POST',
      headers: objectToKeyValuePairs(webhook.headers),
      queryParams: objectToKeyValuePairs(webhook.queryParams),
      bodyTemplate: webhook.bodyTemplate
        ? JSON.stringify(webhook.bodyTemplate, null, 2)
        : JSON.stringify(DEFAULT_BODY_TEMPLATE, null, 2),
    });
    setShowForm(true);
    setFormError(null);
    setBodyTemplateError(null);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      description: '',
      events: [],
      secret: '',
      method: 'POST',
      headers: [],
      queryParams: [],
      bodyTemplate: JSON.stringify(DEFAULT_BODY_TEMPLATE, null, 2),
    });
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
    setFormSubmitAttempted(false);
    setBodyTemplateError(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    const response = await apiClient.deleteWebhook(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    if (response.success) {
      loadWebhooks();
      showNotification('success', 'Webhook deleted successfully');
    } else {
      showNotification('error', response.error || 'Failed to delete webhook');
    }
  };

  const handleToggle = async (id: string) => {
    const response = await apiClient.toggleWebhook(id);
    if (response.success) {
      loadWebhooks();
      showNotification('success', 'Webhook updated successfully');
    } else {
      showNotification('error', response.error || 'Failed to update webhook');
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

  const handleVariableInsert = (variable: string) => {
    navigator.clipboard.writeText(variable);
    showNotification('success', `Copied ${variable} to clipboard`);
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
        size="xlarge"
        footer={
          <>
            <button className="modal-btn cancel" onClick={resetForm}>
              Cancel
            </button>
            <button
              className="modal-btn confirm"
              onClick={() => handleSubmit()}
              disabled={loading}
            >
              {loading ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form webhook-form">
          <div className="webhook-form-grid">
            <div className="webhook-form-main">
              <div className="form-group">
                <label>Webhook Name *</label>
                <input
                  type="text"
                  placeholder="My Integration"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={formSubmitAttempted && !formData.name ? 'input-error' : ''}
                />
                {formSubmitAttempted && !formData.name && (
                  <span className="field-error">Webhook name is required</span>
                )}
              </div>

              <div className="form-row">
                <div className="form-group form-group-method">
                  <label>Method *</label>
                  <select
                    value={formData.method}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value as WebhookMethod })}
                  >
                    {HTTP_METHODS.map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group form-group-url">
                  <label>Webhook URL *</label>
                  <input
                    type="url"
                    placeholder="https://example.com/webhook"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className={formSubmitAttempted && !formData.url ? 'input-error' : ''}
                  />
                  {formSubmitAttempted && !formData.url && (
                    <span className="field-error">Webhook URL is required</span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Events *</label>
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
                {formSubmitAttempted && formData.events.length === 0 && (
                  <span className="field-error">At least one event must be selected</span>
                )}
              </div>

              <KeyValueEditor
                pairs={formData.headers}
                onChange={(headers) => setFormData({ ...formData, headers })}
                label="Headers (optional)"
                keyPlaceholder="Header name"
                valuePlaceholder="Header value"
                supportsVariables
              />

              <KeyValueEditor
                pairs={formData.queryParams}
                onChange={(queryParams) => setFormData({ ...formData, queryParams })}
                label="Query Parameters (optional)"
                keyPlaceholder="Parameter name"
                valuePlaceholder="Parameter value"
                supportsVariables
              />

              <div className="form-group">
                <label>Request Body (JSON) *</label>
                <textarea
                  className={`body-template-editor ${bodyTemplateError ? 'input-error' : ''}`}
                  value={formData.bodyTemplate}
                  onChange={(e) => {
                    setFormData({ ...formData, bodyTemplate: e.target.value });
                    validateBodyTemplate(e.target.value);
                  }}
                  rows={10}
                  placeholder="Enter JSON body template..."
                />
                {bodyTemplateError && (
                  <span className="field-error">{bodyTemplateError}</span>
                )}
                <span className="form-hint">
                  Use {'{{variableName}}'} syntax to insert dynamic values
                </span>
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
            </div>

            <div className="webhook-form-sidebar">
              <VariableHelper
                variables={variables}
                selectedEvents={formData.events}
                onInsert={handleVariableInsert}
              />
            </div>
          </div>
        </form>
      </Modal>

      <div className="manager-list">
        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <span className="loading-text">Loading webhooks...</span>
          </div>
        ) : webhooks.length === 0 ? (
          <p className="empty-message">No webhooks configured</p>
        ) : (
          webhooks.map((webhook) => (
            <div key={webhook.id} className="manager-item">
              <div className="item-info">
                <strong>{webhook.name}</strong>
                <span className={`status-badge ${webhook.enabled ? 'status-completed' : 'status-pending'}`}>
                  {webhook.enabled ? 'Enabled' : 'Disabled'}
                </span>
                <span className="method-badge">{webhook.method || 'POST'}</span>
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
