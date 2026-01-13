import React, { useEffect, useState } from 'react';
import { StoredAccessToken } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { Modal, ConfirmDialog } from './Modal';

const apiClient = new AgentEvalClient();

interface Props {
  onSelect?: (token: StoredAccessToken) => void;
  selectable?: boolean;
}

export function AccessTokensManager({ onSelect, selectable }: Props) {
  const [tokens, setTokens] = useState<StoredAccessToken[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    token: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const resetForm = () => {
    setFormData({ name: '', token: '', description: '' });
    setShowForm(false);
  };

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    setIsLoading(true);
    const response = await apiClient.getAccessTokens();
    if (response.success && response.data) {
      setTokens(response.data);
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.name || !formData.token) return;

    setLoading(true);
    const response = await apiClient.createAccessToken({
      name: formData.name,
      token: formData.token,
      description: formData.description || undefined,
    });

    if (response.success) {
      resetForm();
      loadTokens();
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    await apiClient.deleteAccessToken(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    loadTokens();
  };

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h3>AI Studio Access Tokens</h3>
        <button onClick={() => setShowForm(true)}>
          + Add Token
        </button>
      </div>

      <Modal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        title="Add Access Token"
        footer={
          <>
            <button className="modal-btn cancel" onClick={resetForm}>
              Cancel
            </button>
            <button
              className="modal-btn confirm"
              onClick={() => handleSubmit()}
              disabled={loading || !formData.name || !formData.token}
            >
              {loading ? 'Saving...' : 'Save Token'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Token Name</label>
            <input
              type="text"
              placeholder="Enter token name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Bearer Token</label>
            <input
              type="password"
              placeholder="Enter bearer token (will be encrypted)"
              value={formData.token}
              onChange={(e) => setFormData({ ...formData, token: e.target.value })}
            />
            <span className="form-hint">The bearer token used for API authentication</span>
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
            <span className="loading-text">Loading tokens...</span>
          </div>
        ) : tokens.length === 0 ? (
          <p className="empty-message">No access tokens stored</p>
        ) : (
          tokens.map((token) => (
            <div key={token.id} className="manager-item">
              <div className="item-info">
                <strong>{token.name}</strong>
                {token.description && <span className="item-desc">{token.description}</span>}
              </div>
              <div className="item-actions">
                {selectable && onSelect && (
                  <button onClick={() => onSelect(token)} className="select-btn">
                    Select
                  </button>
                )}
                <button onClick={() => setDeleteConfirm({ open: true, id: token.id })} className="delete-btn">
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
        title="Delete Access Token"
        message="Are you sure you want to delete this access token? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
