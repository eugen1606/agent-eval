import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StoredEvaluation, EvaluationResult, FlowConfig } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { Modal, ConfirmDialog } from './Modal';
import { useAppContext } from '../context/AppContext';

const apiClient = new AgentEvalClient();

export function EvaluationsManager() {
  const navigate = useNavigate();
  const { loadEvaluation } = useAppContext();
  const [evaluations, setEvaluations] = useState<StoredEvaluation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  useEffect(() => {
    loadEvaluations();
  }, []);

  const loadEvaluations = async () => {
    const response = await apiClient.getEvaluations();
    if (response.success && response.data) {
      setEvaluations(response.data);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.name || !formData.finalOutputJson) return;

    try {
      const finalOutput = JSON.parse(formData.finalOutputJson);
      const flowExport = formData.flowExportJson
        ? JSON.parse(formData.flowExportJson)
        : undefined;

      setLoading(true);

      let response;
      if (editingId) {
        response = await apiClient.updateEvaluation(editingId, {
          name: formData.name,
          finalOutput,
          flowExport,
          flowId: formData.flowId || undefined,
          description: formData.description || undefined,
        });
      } else {
        response = await apiClient.createEvaluation({
          name: formData.name,
          finalOutput,
          flowExport,
          flowId: formData.flowId || undefined,
          description: formData.description || undefined,
        });
      }

      if (response.success) {
        resetForm();
        loadEvaluations();
      }
    } catch {
      setJsonError('Invalid JSON format');
    }
    setLoading(false);
  };

  const handleEdit = (ev: StoredEvaluation) => {
    setEditingId(ev.id);
    setFormData({
      name: ev.name,
      finalOutputJson: JSON.stringify(ev.finalOutput, null, 2),
      flowExportJson: ev.flowExport ? JSON.stringify(ev.flowExport, null, 2) : '',
      flowId: ev.flowId || '',
      description: ev.description || '',
    });
    setShowForm(true);
    setJsonError(null);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      finalOutputJson: '',
      flowExportJson: '',
      flowId: '',
      description: ''
    });
    setShowForm(false);
    setEditingId(null);
    setJsonError(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    await apiClient.deleteEvaluation(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    loadEvaluations();
  };

  const handleExport = async (evaluation: StoredEvaluation, format: 'json' | 'csv') => {
    try {
      const blob = await apiClient.exportEvaluation(evaluation.id, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evaluation-${evaluation.name}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleContinueEvaluating = (evaluation: StoredEvaluation) => {
    // Extract results and config from the stored evaluation
    const finalOutput = evaluation.finalOutput as {
      results?: EvaluationResult[];
      config?: FlowConfig;
    };

    const results = finalOutput.results || [];
    const config: FlowConfig = finalOutput.config || {
      accessToken: '',
      basePath: '',
      flowId: evaluation.flowId || '',
    };

    // Load into app context and navigate to evaluate tab
    loadEvaluation(evaluation.id, config, results);
    navigate('/evaluate');
  };

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h3>Stored Evaluations</h3>
        <button onClick={() => setShowForm(true)}>
          + Add Evaluation
        </button>
      </div>

      <Modal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        title={editingId ? 'Edit Evaluation' : 'Add Evaluation'}
        footer={
          <>
            <button className="modal-btn cancel" onClick={resetForm}>
              Cancel
            </button>
            <button
              className="modal-btn confirm"
              onClick={() => handleSubmit()}
              disabled={loading || !formData.name || !formData.finalOutputJson}
            >
              {loading ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Evaluation Name</label>
            <input
              type="text"
              placeholder="Enter evaluation name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Final Output (JSON)</label>
            <textarea
              placeholder='{"results": [...]}'
              value={formData.finalOutputJson}
              onChange={(e) => {
                setFormData({ ...formData, finalOutputJson: e.target.value });
                setJsonError(null);
              }}
              rows={4}
            />
          </div>
          <div className="form-group">
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
          <div className="form-group">
            <label>Flow ID (optional)</label>
            <input
              type="text"
              placeholder="Enter flow ID"
              value={formData.flowId}
              onChange={(e) => setFormData({ ...formData, flowId: e.target.value })}
            />
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
                <button onClick={() => handleContinueEvaluating(ev)} className="evaluate-btn">
                  Evaluate
                </button>
                <button onClick={() => navigate(`/dashboard?id=${ev.id}`)} className="dashboard-btn">
                  Dashboard
                </button>
                <button onClick={() => handleExport(ev, 'json')} className="export-btn">
                  JSON
                </button>
                <button onClick={() => handleExport(ev, 'csv')} className="export-btn">
                  CSV
                </button>
                <button onClick={() => handleEdit(ev)} className="edit-btn">
                  Edit
                </button>
                <button onClick={() => setDeleteConfirm({ open: true, id: ev.id })} className="delete-btn">
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
        title="Delete Evaluation"
        message="Are you sure you want to delete this evaluation? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
