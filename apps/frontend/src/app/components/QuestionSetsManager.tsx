import React, { useEffect, useState } from 'react';
import { StoredQuestionSet } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { Modal, ConfirmDialog } from './Modal';

const apiClient = new AgentEvalClient();

interface Props {
  onSelect?: (questionSet: StoredQuestionSet) => void;
  selectable?: boolean;
}

export function QuestionSetsManager({ onSelect, selectable }: Props) {
  const [questionSets, setQuestionSets] = useState<StoredQuestionSet[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    questionsJson: '',
    description: '',
  });
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  useEffect(() => {
    loadQuestionSets();
  }, []);

  const loadQuestionSets = async () => {
    const response = await apiClient.getQuestionSets();
    if (response.success && response.data) {
      setQuestionSets(response.data);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.name || !formData.questionsJson) return;

    try {
      const questions = JSON.parse(formData.questionsJson);
      if (!Array.isArray(questions)) {
        setJsonError('Questions must be an array');
        return;
      }

      setLoading(true);

      let response;
      if (editingId) {
        response = await apiClient.updateQuestionSet(editingId, {
          name: formData.name,
          questions,
          description: formData.description || undefined,
        });
      } else {
        response = await apiClient.createQuestionSet({
          name: formData.name,
          questions,
          description: formData.description || undefined,
        });
      }

      if (response.success) {
        resetForm();
        loadQuestionSets();
      }
    } catch {
      setJsonError('Invalid JSON format');
    }
    setLoading(false);
  };

  const handleEdit = (qs: StoredQuestionSet) => {
    setEditingId(qs.id);
    setFormData({
      name: qs.name,
      questionsJson: JSON.stringify(qs.questions, null, 2),
      description: qs.description || '',
    });
    setShowForm(true);
    setJsonError(null);
  };

  const resetForm = () => {
    setFormData({ name: '', questionsJson: '', description: '' });
    setShowForm(false);
    setEditingId(null);
    setJsonError(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    await apiClient.deleteQuestionSet(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    loadQuestionSets();
  };

  const exampleJson = `[
  { "question": "What is 2+2?", "expectedAnswer": "4" },
  { "question": "Capital of France?" },
  { "question": "Explain gravity" }
]`;

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h3>Question Sets</h3>
        <button onClick={() => setShowForm(true)}>
          + Add Question Set
        </button>
      </div>

      <Modal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        title={editingId ? 'Edit Question Set' : 'Add Question Set'}
        footer={
          <>
            <button className="modal-btn cancel" onClick={resetForm}>
              Cancel
            </button>
            <button
              className="modal-btn confirm"
              onClick={() => handleSubmit()}
              disabled={loading || !formData.name || !formData.questionsJson}
            >
              {loading ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Question Set Name</label>
            <input
              type="text"
              placeholder="Enter question set name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Questions (JSON)</label>
            <textarea
              placeholder={exampleJson}
              value={formData.questionsJson}
              onChange={(e) => {
                setFormData({ ...formData, questionsJson: e.target.value });
                setJsonError(null);
              }}
              rows={6}
            />
            {jsonError && <span className="error">{jsonError}</span>}
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
        {questionSets.length === 0 ? (
          <p className="empty-message">No question sets stored</p>
        ) : (
          questionSets.map((qs) => (
            <div key={qs.id} className="manager-item">
              <div className="item-info">
                <strong>{qs.name}</strong>
                <span className="item-meta">{qs.questions.length} questions</span>
                {qs.description && <span className="item-desc">{qs.description}</span>}
              </div>
              <div className="item-actions">
                {selectable && onSelect && (
                  <button onClick={() => onSelect(qs)} className="select-btn">
                    Select
                  </button>
                )}
                <button onClick={() => handleEdit(qs)} className="edit-btn">
                  Edit
                </button>
                <button onClick={() => setDeleteConfirm({ open: true, id: qs.id })} className="delete-btn">
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
        title="Delete Question Set"
        message="Are you sure you want to delete this question set? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
