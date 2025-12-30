import React, { useEffect, useState } from 'react';
import { StoredEvaluation } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';

const apiClient = new AgentEvalClient();

export function EvaluationsManager() {
  const [evaluations, setEvaluations] = useState<StoredEvaluation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    finalOutputJson: '',
    flowExportJson: '',
    flowId: '',
    description: '',
  });
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadEvaluations();
  }, []);

  const loadEvaluations = async () => {
    const response = await apiClient.getEvaluations();
    if (response.success && response.data) {
      setEvaluations(response.data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.finalOutputJson) return;

    try {
      const finalOutput = JSON.parse(formData.finalOutputJson);
      const flowExport = formData.flowExportJson
        ? JSON.parse(formData.flowExportJson)
        : undefined;

      setLoading(true);
      const response = await apiClient.createEvaluation({
        name: formData.name,
        finalOutput,
        flowExport,
        flowId: formData.flowId || undefined,
        description: formData.description || undefined,
      });

      if (response.success) {
        setFormData({
          name: '',
          finalOutputJson: '',
          flowExportJson: '',
          flowId: '',
          description: ''
        });
        setShowForm(false);
        setJsonError(null);
        loadEvaluations();
      }
    } catch {
      setJsonError('Invalid JSON format');
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this evaluation?')) return;
    await apiClient.deleteEvaluation(id);
    loadEvaluations();
  };

  const handleExport = (evaluation: StoredEvaluation) => {
    const data = JSON.stringify(evaluation, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluation-${evaluation.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h3>Stored Evaluations</h3>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Evaluation'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="manager-form">
          <input
            type="text"
            placeholder="Evaluation name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div className="textarea-wrapper">
            <label>Final Output (JSON)</label>
            <textarea
              placeholder='{"results": [...]}'
              value={formData.finalOutputJson}
              onChange={(e) => {
                setFormData({ ...formData, finalOutputJson: e.target.value });
                setJsonError(null);
              }}
              rows={4}
              required
            />
          </div>
          <div className="textarea-wrapper">
            <label>Flow Export (JSON, optional)</label>
            <textarea
              placeholder='{"flowData": ...}'
              value={formData.flowExportJson}
              onChange={(e) => {
                setFormData({ ...formData, flowExportJson: e.target.value });
                setJsonError(null);
              }}
              rows={4}
            />
          </div>
          {jsonError && <span className="error">{jsonError}</span>}
          <input
            type="text"
            placeholder="Flow ID (optional)"
            value={formData.flowId}
            onChange={(e) => setFormData({ ...formData, flowId: e.target.value })}
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Evaluation'}
          </button>
        </form>
      )}

      <div className="manager-list">
        {evaluations.length === 0 ? (
          <p className="empty-message">No evaluations stored</p>
        ) : (
          evaluations.map((ev) => (
            <div key={ev.id} className="manager-item expandable">
              <div
                className="item-info clickable"
                onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
              >
                <strong>{ev.name}</strong>
                {ev.flowId && <span className="item-meta">Flow: {ev.flowId}</span>}
                {ev.description && <span className="item-desc">{ev.description}</span>}
                <span className="item-date">
                  {new Date(ev.createdAt).toLocaleDateString()}
                </span>
              </div>
              {expandedId === ev.id && (
                <div className="item-expanded">
                  <div className="json-preview">
                    <strong>Final Output:</strong>
                    <pre>{JSON.stringify(ev.finalOutput, null, 2).slice(0, 500)}...</pre>
                  </div>
                  {ev.flowExport && (
                    <div className="json-preview">
                      <strong>Flow Export:</strong>
                      <pre>{JSON.stringify(ev.flowExport, null, 2).slice(0, 500)}...</pre>
                    </div>
                  )}
                </div>
              )}
              <div className="item-actions">
                <button onClick={() => handleExport(ev)} className="export-btn">
                  Export
                </button>
                <button onClick={() => handleDelete(ev.id)} className="delete-btn">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
