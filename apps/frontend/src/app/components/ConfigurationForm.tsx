import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { QuestionInput } from '@agent-eval/shared';
import { v4 as uuidv4 } from 'uuid';

export function ConfigurationForm() {
  const { state, setConfig, setQuestions } = useAppContext();
  const [questionsJson, setQuestionsJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleConfigChange = (field: string, value: string) => {
    setConfig({ ...state.config, [field]: value });
  };

  const handleQuestionsChange = (value: string) => {
    setQuestionsJson(value);
    setJsonError(null);

    if (!value.trim()) {
      setQuestions([]);
      return;
    }

    try {
      const parsed = JSON.parse(value);
      const questions: QuestionInput[] = Array.isArray(parsed)
        ? parsed.map((q: { question: string; expectedAnswer?: string }) => ({
            id: uuidv4(),
            question: q.question || q,
            expectedAnswer: q.expectedAnswer,
          }))
        : [];
      setQuestions(questions);
    } catch (e) {
      setJsonError('Invalid JSON format');
    }
  };

  const exampleJson = `[
  { "question": "What is 2+2?", "expectedAnswer": "4" },
  { "question": "What is the capital of France?", "expectedAnswer": "Paris" }
]`;

  return (
    <div className="configuration-form">
      <h2>Configuration</h2>

      <div className="form-group">
        <label htmlFor="accessToken">Access Token</label>
        <input
          id="accessToken"
          type="password"
          value={state.config.accessToken}
          onChange={(e) => handleConfigChange('accessToken', e.target.value)}
          placeholder="Enter your access token"
        />
      </div>

      <div className="form-group">
        <label htmlFor="basePath">Base Path</label>
        <input
          id="basePath"
          type="text"
          value={state.config.basePath}
          onChange={(e) => handleConfigChange('basePath', e.target.value)}
          placeholder="https://api.example.com"
        />
      </div>

      <div className="form-group">
        <label htmlFor="flowId">Flow ID</label>
        <input
          id="flowId"
          type="text"
          value={state.config.flowId}
          onChange={(e) => handleConfigChange('flowId', e.target.value)}
          placeholder="Enter flow ID"
        />
      </div>

      <div className="form-group">
        <label htmlFor="questions">
          Questions (JSON)
          <button
            type="button"
            className="example-btn"
            onClick={() => handleQuestionsChange(exampleJson)}
          >
            Load Example
          </button>
        </label>
        <textarea
          id="questions"
          value={questionsJson}
          onChange={(e) => handleQuestionsChange(e.target.value)}
          placeholder={exampleJson}
          rows={8}
        />
        {jsonError && <span className="error">{jsonError}</span>}
        {state.questions.length > 0 && (
          <span className="success">{state.questions.length} questions loaded</span>
        )}
      </div>
    </div>
  );
}
