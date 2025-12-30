import React, { useEffect, useState } from 'react';
import { StoredFlowConfig } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';

const apiClient = new AgentEvalClient();

interface Props {
  onSelect?: (flowConfig: StoredFlowConfig) => void;
  selectable?: boolean;
}

export function FlowConfigsManager({ onSelect, selectable }: Props) {
  const [flowConfigs, setFlowConfigs] = useState<StoredFlowConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    flowId: '',
    basePath: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFlowConfigs();
  }, []);

  const loadFlowConfigs = async () => {
    const response = await apiClient.getFlowConfigs();
    if (response.success && response.data) {
      setFlowConfigs(response.data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.flowId) return;

    setLoading(true);

    let response;
    if (editingId) {
      response = await apiClient.updateFlowConfig(editingId, {
        name: formData.name,
        flowId: formData.flowId,
        basePath: formData.basePath || undefined,
        description: formData.description || undefined,
      });
    } else {
      response = await apiClient.createFlowConfig({
        name: formData.name,
        flowId: formData.flowId,
        basePath: formData.basePath || undefined,
        description: formData.description || undefined,
      });
    }

    if (response.success) {
      resetForm();
      loadFlowConfigs();
    }
    setLoading(false);
  };

  const handleEdit = (fc: StoredFlowConfig) => {
    setEditingId(fc.id);
    setFormData({
      name: fc.name,
      flowId: fc.flowId,
      basePath: fc.basePath || '',
      description: fc.description || '',
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({ name: '', flowId: '', basePath: '', description: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this flow config?')) return;
    await apiClient.deleteFlowConfig(id);
    loadFlowConfigs();
  };

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h3>Flow Configurations</h3>
        <button onClick={() => showForm ? resetForm() : setShowForm(true)}>
          {showForm ? 'Cancel' : '+ Add Flow Config'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="manager-form">
          <input
            type="text"
            placeholder="Config name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Flow ID"
            value={formData.flowId}
            onChange={(e) => setFormData({ ...formData, flowId: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Base path (optional)"
            value={formData.basePath}
            onChange={(e) => setFormData({ ...formData, basePath: e.target.value })}
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Saving...' : editingId ? 'Update Flow Config' : 'Save Flow Config'}
          </button>
        </form>
      )}

      <div className="manager-list">
        {flowConfigs.length === 0 ? (
          <p className="empty-message">No flow configs stored</p>
        ) : (
          flowConfigs.map((fc) => (
            <div key={fc.id} className="manager-item">
              <div className="item-info">
                <strong>{fc.name}</strong>
                <span className="item-meta">Flow: {fc.flowId}</span>
                {fc.basePath && <span className="item-meta">{fc.basePath}</span>}
                {fc.description && <span className="item-desc">{fc.description}</span>}
              </div>
              <div className="item-actions">
                {selectable && onSelect && (
                  <button onClick={() => onSelect(fc)} className="select-btn">
                    Select
                  </button>
                )}
                <button onClick={() => handleEdit(fc)} className="edit-btn">
                  Edit
                </button>
                <button onClick={() => handleDelete(fc.id)} className="delete-btn">
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
