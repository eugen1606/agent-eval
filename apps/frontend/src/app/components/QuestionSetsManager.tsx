import React, { useEffect, useState } from 'react';
import { StoredQuestionSet } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';

const apiClient = new AgentEvalClient();

interface Props {
  onSelect?: (questionSet: StoredQuestionSet) => void;
  selectable?: boolean;
}

export function QuestionSetsManager({ onSelect, selectable }: Props) {
  const [questionSets, setQuestionSets] = useState<StoredQuestionSet[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    questionsJson: '',
    description: '',
  });
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadQuestionSets();
  }, []);

  const loadQuestionSets = async () => {
    const response = await apiClient.getQuestionSets();
    if (response.success && response.data) {
      setQuestionSets(response.data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.questionsJson) return;

    try {
      const questions = JSON.parse(formData.questionsJson);
      if (!Array.isArray(questions)) {
        setJsonError('Questions must be an array');
        return;
      }

      setLoading(true);
      const response = await apiClient.createQuestionSet({
        name: formData.name,
        questions,
        description: formData.description || undefined,
      });

      if (response.success) {
        setFormData({ name: '', questionsJson: '', description: '' });
        setShowForm(false);
        setJsonError(null);
        loadQuestionSets();
      }
    } catch {
      setJsonError('Invalid JSON format');
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this question set?')) return;
    await apiClient.deleteQuestionSet(id);
    loadQuestionSets();
  };

  const exampleJson = `[
  { "question": "What is 2+2?", "expectedAnswer": "4" },
  { "question": "Capital of France?", "expectedAnswer": "Paris" }
]`;

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h3>Question Sets</h3>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Question Set'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="manager-form">
          <input
            type="text"
            placeholder="Question set name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div className="textarea-wrapper">
            <textarea
              placeholder={exampleJson}
              value={formData.questionsJson}
              onChange={(e) => {
                setFormData({ ...formData, questionsJson: e.target.value });
                setJsonError(null);
              }}
              rows={6}
              required
            />
            {jsonError && <span className="error">{jsonError}</span>}
          </div>
          <input
            type="text"
            placeholder="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Question Set'}
          </button>
        </form>
      )}

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
                <button onClick={() => handleDelete(qs.id)} className="delete-btn">
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
