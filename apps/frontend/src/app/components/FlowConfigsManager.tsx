import React, { useEffect, useState } from 'react';
import { StoredFlowConfig } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { Modal, ConfirmDialog } from './Modal';
import { useNotification } from '../context/NotificationContext';

const apiClient = new AgentEvalClient();

interface Props {
  onSelect?: (flowConfig: StoredFlowConfig) => void;
  selectable?: boolean;
}

export function FlowConfigsManager({ onSelect, selectable }: Props) {
  const { showNotification } = useNotification();
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
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);

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
    setFormSubmitAttempted(true);
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
      showNotification('success', editingId ? 'Flow config updated successfully' : 'Flow config created successfully');
    } else {
      showNotification('error', response.error || 'Failed to save flow config');
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
    setFormSubmitAttempted(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    const response = await apiClient.deleteFlowConfig(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    if (response.success) {
      loadFlowConfigs();
      showNotification('success', 'Flow config deleted successfully');
    } else {
      showNotification('error', response.error || 'Failed to delete flow config');
    }
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
              disabled={loading}
            >
              {loading ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Config Name *</label>
            <input
              type="text"
              placeholder="Enter config name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={formSubmitAttempted && !formData.name ? 'input-error' : ''}
            />
            {formSubmitAttempted && !formData.name && (
              <span className="field-error">Config name is required</span>
            )}
          </div>
          <div className="form-group">
            <label>Flow ID *</label>
            <input
              type="text"
              placeholder="Enter flow ID"
              value={formData.flowId}
              onChange={(e) => setFormData({ ...formData, flowId: e.target.value })}
              className={formSubmitAttempted && !formData.flowId ? 'input-error' : ''}
            />
            {formSubmitAttempted && !formData.flowId && (
              <span className="field-error">Flow ID is required</span>
            )}
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
