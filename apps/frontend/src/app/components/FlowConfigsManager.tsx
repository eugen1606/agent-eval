import React, { useEffect, useState } from 'react';
import { StoredFlowConfig } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { Modal, ConfirmDialog } from './Modal';

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
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  useEffect(() => {
    loadFlowConfigs();
  }, []);

  const loadFlowConfigs = async () => {
    setIsLoading(true);
    const response = await apiClient.getFlowConfigs();
    if (response.success && response.data) {
      setFlowConfigs(response.data);
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
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

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    await apiClient.deleteFlowConfig(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    loadFlowConfigs();
  };

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h3>Flow Configurations</h3>
        <button onClick={() => setShowForm(true)}>
          + Add Flow Config
        </button>
      </div>

      <Modal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        title={editingId ? 'Edit Flow Config' : 'Add Flow Config'}
        footer={
          <>
            <button className="modal-btn cancel" onClick={resetForm}>
              Cancel
            </button>
            <button
              className="modal-btn confirm"
              onClick={() => handleSubmit()}
              disabled={loading || !formData.name || !formData.flowId}
            >
              {loading ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Config Name</label>
            <input
              type="text"
              placeholder="Enter config name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Flow ID</label>
            <input
              type="text"
              placeholder="Enter flow ID"
              value={formData.flowId}
              onChange={(e) => setFormData({ ...formData, flowId: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Base Path (optional)</label>
            <input
              type="text"
              placeholder="Enter base path"
              value={formData.basePath}
              onChange={(e) => setFormData({ ...formData, basePath: e.target.value })}
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
        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <span className="loading-text">Loading flow configs...</span>
          </div>
        ) : flowConfigs.length === 0 ? (
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
                <button onClick={() => setDeleteConfirm({ open: true, id: fc.id })} className="delete-btn">
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
        title="Delete Flow Config"
        message="Are you sure you want to delete this flow configuration? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
