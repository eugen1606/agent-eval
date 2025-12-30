import React, { useEffect, useState } from 'react';
import { StoredAccessToken } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';

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

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    const response = await apiClient.getAccessTokens();
    if (response.success && response.data) {
      setTokens(response.data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.token) return;

    setLoading(true);
    const response = await apiClient.createAccessToken({
      name: formData.name,
      token: formData.token,
      description: formData.description || undefined,
    });

    if (response.success) {
      setFormData({ name: '', token: '', description: '' });
      setShowForm(false);
      loadTokens();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this access token?')) return;
    await apiClient.deleteAccessToken(id);
    loadTokens();
  };

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h3>Access Tokens</h3>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Token'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="manager-form">
          <input
            type="text"
            placeholder="Token name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder="Access token (will be encrypted)"
            value={formData.token}
            onChange={(e) => setFormData({ ...formData, token: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Token'}
          </button>
        </form>
      )}

      <div className="manager-list">
        {tokens.length === 0 ? (
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
                <button onClick={() => handleDelete(token.id)} className="delete-btn">
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
