import React, { useEffect, useState, useRef } from 'react';
import { StoredQuestionSet } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { Modal, ConfirmDialog, AlertDialog } from './Modal';
import { useNotification } from '../context/NotificationContext';

const apiClient = new AgentEvalClient();

interface Props {
  onSelect?: (questionSet: StoredQuestionSet) => void;
  selectable?: boolean;
}

export function QuestionSetsManager({ onSelect, selectable }: Props) {
  const { showNotification } = useNotification();
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
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);
  const [importError, setImportError] = useState<{
    message: string;
    showSchema: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadQuestionSets();
  }, []);

  const loadQuestionSets = async () => {
    setIsLoading(true);
    const response = await apiClient.getQuestionSets();
    if (response.success && response.data) {
      setQuestionSets(response.data);
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormSubmitAttempted(true);
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
        showNotification('success', editingId ? 'Question set updated successfully' : 'Question set created successfully');
      } else {
        showNotification('error', response.error || 'Failed to save question set');
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
    setFormSubmitAttempted(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    const response = await apiClient.deleteQuestionSet(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    if (response.success) {
      loadQuestionSets();
      showNotification('success', 'Question set deleted successfully');
    } else {
      showNotification('error', response.error || 'Failed to delete question set');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Extract questions from various formats
      let questions: unknown;
      let name = file.name.replace(/\.json$/i, '');

      if (Array.isArray(data)) {
        questions = data;
      } else if (data.questions && Array.isArray(data.questions)) {
        questions = data.questions;
        if (data.name) name = data.name;
      } else {
        setImportError({
          message:
            'Invalid JSON structure. The file must contain either an array of questions or an object with a "questions" array.',
          showSchema: true,
        });
        return;
      }

      const response = await apiClient.importQuestionSet({
        name,
        questions,
        description: data.description,
      });

      if (response.success) {
        loadQuestionSets();
        showNotification('success', 'Question set imported successfully');
      } else {
        setImportError({
          message: response.error || 'Import failed',
          showSchema: false,
        });
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        setImportError({
          message: 'Invalid JSON syntax. The file does not contain valid JSON.',
          showSchema: true,
        });
      } else {
        setImportError({
          message: error instanceof Error ? error.message : 'Import failed',
          showSchema: false,
        });
      }
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
        <div className="header-actions">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".json"
            style={{ display: 'none' }}
          />
          <button onClick={handleImportClick} className="import-btn">
            Import JSON
          </button>
          <button onClick={() => setShowForm(true)}>+ Add Question Set</button>
        </div>
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
              disabled={loading}
            >
              {loading ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Question Set Name *</label>
            <input
              type="text"
              placeholder="Enter question set name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className={formSubmitAttempted && !formData.name ? 'input-error' : ''}
            />
            {formSubmitAttempted && !formData.name && (
              <span className="field-error">Question set name is required</span>
            )}
          </div>
          <div className="form-group">
            <label>Questions (JSON) *</label>
            <textarea
              placeholder={exampleJson}
              value={formData.questionsJson}
              onChange={(e) => {
                setFormData({ ...formData, questionsJson: e.target.value });
                setJsonError(null);
              }}
              rows={6}
              className={formSubmitAttempted && !formData.questionsJson ? 'input-error' : ''}
            />
            {jsonError && <span className="error">{jsonError}</span>}
            {formSubmitAttempted && !formData.questionsJson && !jsonError && (
              <span className="field-error">Questions JSON is required</span>
            )}
          </div>
          <div className="form-group">
            <label>Description (optional)</label>
            <input
              type="text"
              placeholder="Enter description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>
        </form>
      </Modal>

      <div className="manager-list">
        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <span className="loading-text">Loading question sets...</span>
          </div>
        ) : questionSets.length === 0 ? (
          <p className="empty-message">No question sets stored</p>
        ) : (
          questionSets.map((qs) => (
            <div key={qs.id} className="manager-item">
              <div className="item-info">
                <strong>{qs.name}</strong>
                <span className="item-meta">
                  {qs.questions.length} questions
                </span>
                {qs.description && (
                  <span className="item-desc">{qs.description}</span>
                )}
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
                <button
                  onClick={() => setDeleteConfirm({ open: true, id: qs.id })}
                  className="delete-btn"
                >
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

      <AlertDialog
        isOpen={!!importError}
        onClose={() => setImportError(null)}
        title="Import Error"
        variant="error"
      >
        <div className="import-error-content">
          <p className="error-message">{importError?.message}</p>
          {importError?.showSchema && (
            <div className="json-schema-help">
              <p className="schema-intro">The JSON file must this format:</p>
              <div className="schema-section">
                <pre className="json-example">{`[
  {
    "question": "What is 2+2?",
    "expectedAnswer": "4"
  },
  {
    "question": "Capital of France?",
  }
]`}</pre>
              </div>
              <p className="schema-note">
                <strong>Note:</strong> Each question must have a "question"
                field. The "expectedAnswer" field is optional.
              </p>
            </div>
          )}
        </div>
      </AlertDialog>
    </div>
  );
}
