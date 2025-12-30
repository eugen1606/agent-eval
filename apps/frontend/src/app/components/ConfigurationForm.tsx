import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { QuestionInput, StoredAccessToken, StoredQuestionSet, StoredFlowConfig } from '@agent-eval/shared';
import { AgentEvalClient } from '@agent-eval/api-client';
import { v4 as uuidv4 } from 'uuid';

const apiClient = new AgentEvalClient();

export function ConfigurationForm() {
  const { state, setConfig, setQuestions } = useAppContext();
  const [questionsJson, setQuestionsJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [useManualToken, setUseManualToken] = useState(true);
  const [useManualFlowConfig, setUseManualFlowConfig] = useState(true);

  // Stored data
  const [storedTokens, setStoredTokens] = useState<StoredAccessToken[]>([]);
  const [storedQuestionSets, setStoredQuestionSets] = useState<StoredQuestionSet[]>([]);
  const [storedFlowConfigs, setStoredFlowConfigs] = useState<StoredFlowConfig[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string>('');
  const [selectedFlowConfigId, setSelectedFlowConfigId] = useState<string>('');
  const [selectedQuestionSetId, setSelectedQuestionSetId] = useState<string>('');

  useEffect(() => {
    loadStoredData();
  }, []);

  const loadStoredData = async () => {
    const [tokensRes, questionsRes, flowConfigsRes] = await Promise.all([
      apiClient.getAccessTokens(),
      apiClient.getQuestionSets(),
      apiClient.getFlowConfigs(),
    ]);

    if (tokensRes.success && tokensRes.data) setStoredTokens(tokensRes.data);
    if (questionsRes.success && questionsRes.data) setStoredQuestionSets(questionsRes.data);
    if (flowConfigsRes.success && flowConfigsRes.data) setStoredFlowConfigs(flowConfigsRes.data);
  };

  const handleConfigChange = (field: string, value: string) => {
    setConfig({ ...state.config, [field]: value });
  };

  const handleTokenSelect = (tokenId: string) => {
    setSelectedTokenId(tokenId);
    if (tokenId) {
      setConfig({
        ...state.config,
        accessToken: tokenId, // Use token ID, backend will decrypt
      });
    }
  };

  const handleQuestionSetSelect = (setId: string) => {
    setSelectedQuestionSetId(setId);
    const questionSet = storedQuestionSets.find((qs) => qs.id === setId);
    if (questionSet) {
      const questions: QuestionInput[] = questionSet.questions.map((q) => ({
        id: uuidv4(),
        question: q.question,
        expectedAnswer: q.expectedAnswer,
      }));
      setQuestions(questions);
      setQuestionsJson(JSON.stringify(questionSet.questions, null, 2));
    }
  };

  const handleFlowConfigSelect = (configId: string) => {
    setSelectedFlowConfigId(configId);
    const flowConfig = storedFlowConfigs.find((fc) => fc.id === configId);
    if (flowConfig) {
      setConfig({
        ...state.config,
        flowId: flowConfig.flowId,
        basePath: flowConfig.basePath || '',
      });
    }
  };

  const handleQuestionsChange = (value: string) => {
    setQuestionsJson(value);
    setJsonError(null);
    setSelectedQuestionSetId('');

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
    } catch {
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

      {/* Access Token Section */}
      <div className="form-group">
        <label>
          Access Token
          <div className="toggle-group">
            <button
              type="button"
              className={useManualToken ? 'active' : ''}
              onClick={() => setUseManualToken(true)}
            >
              Manual
            </button>
            <button
              type="button"
              className={!useManualToken ? 'active' : ''}
              onClick={() => setUseManualToken(false)}
            >
              Stored
            </button>
          </div>
        </label>
        {useManualToken ? (
          <input
            type="password"
            value={state.config.accessToken}
            onChange={(e) => handleConfigChange('accessToken', e.target.value)}
            placeholder="Enter your access token"
          />
        ) : (
          <select
            value={selectedTokenId}
            onChange={(e) => handleTokenSelect(e.target.value)}
          >
            <option value="">Select a stored token...</option>
            {storedTokens.map((token) => (
              <option key={token.id} value={token.id}>
                {token.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Flow Configuration Section */}
      <div className="form-group">
        <label>
          Flow Configuration
          <div className="toggle-group">
            <button
              type="button"
              className={useManualFlowConfig ? 'active' : ''}
              onClick={() => setUseManualFlowConfig(true)}
            >
              Manual
            </button>
            <button
              type="button"
              className={!useManualFlowConfig ? 'active' : ''}
              onClick={() => setUseManualFlowConfig(false)}
            >
              Stored
            </button>
          </div>
        </label>
        {useManualFlowConfig ? (
          <div className="flow-config-inputs">
            <input
              type="text"
              value={state.config.basePath}
              onChange={(e) => handleConfigChange('basePath', e.target.value)}
              placeholder="Base path (e.g., https://api.example.com)"
            />
            <input
              type="text"
              value={state.config.flowId}
              onChange={(e) => handleConfigChange('flowId', e.target.value)}
              placeholder="Flow ID"
            />
          </div>
        ) : (
          <select
            value={selectedFlowConfigId}
            onChange={(e) => handleFlowConfigSelect(e.target.value)}
          >
            <option value="">Select a flow configuration...</option>
            {storedFlowConfigs.map((fc) => (
              <option key={fc.id} value={fc.id}>
                {fc.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Questions */}
      <div className="form-group">
        <label htmlFor="questions">
          Questions (JSON)
          <div className="label-actions">
            {storedQuestionSets.length > 0 && (
              <select
                className="inline-select"
                value={selectedQuestionSetId}
                onChange={(e) => handleQuestionSetSelect(e.target.value)}
              >
                <option value="">Load saved set...</option>
                {storedQuestionSets.map((qs) => (
                  <option key={qs.id} value={qs.id}>
                    {qs.name} ({qs.questions.length} questions)
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="example-btn"
              onClick={() => handleQuestionsChange(exampleJson)}
            >
              Load Example
            </button>
          </div>
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
