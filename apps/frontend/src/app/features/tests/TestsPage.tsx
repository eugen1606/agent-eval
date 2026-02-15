import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  StoredTest,
  StoredAccessToken,
  StoredQuestionSet,
  StoredFlowConfig,
  StoredWebhook,
  StoredTag,
  StoredPersona,
  LLMJudgeStatusResponse,
  TestsSortField,
  SortDirection,
  TestType,
  ConversationExecutionMode,
  CreateScenarioRequest,
  CreateTestRequest,
} from '@agent-eval/shared';
import { Modal, ConfirmDialog } from '../../components/Modal';
import { Pagination } from '../../components/Pagination';
import { FilterBar, FilterDefinition, SortOption, ActiveFilter } from '../../components/FilterBar';
import { SearchableSelect } from '../../components/SearchableSelect';
import { useNotification } from '../../context/NotificationContext';
import { apiClient } from '../../apiClient';
import {
  downloadExportBundle,
  generateExportFilename,
  ImportModal,
} from '../../shared/exportImportUtils';
import styles from './tests.module.scss';

interface ScenarioFormItem extends CreateScenarioRequest {
  _tempId: string;
}

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
};

export function TestsPage() {
  const { showNotification } = useNotification();
  const [tests, setTests] = useState<StoredTest[]>([]);
  const [accessTokens, setAccessTokens] = useState<StoredAccessToken[]>([]);
  const [questionSets, setQuestionSets] = useState<StoredQuestionSet[]>([]);
  const [flowConfigs, setFlowConfigs] = useState<StoredFlowConfig[]>([]);
  const [webhooks, setWebhooks] = useState<StoredWebhook[]>([]);
  const [evaluators, setEvaluators] = useState<LLMJudgeStatusResponse['evaluators']>([]);
  const [tags, setTags] = useState<StoredTag[]>([]);
  const [personas, setPersonas] = useState<StoredPersona[]>([]);
  const [simulatedUserCredentials, setSimulatedUserCredentials] = useState<StoredAccessToken[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'qa' as TestType,
    flowConfigId: '',
    accessTokenId: '',
    questionSetId: '',
    multiStepEvaluation: false,
    webhookId: '',
    evaluatorId: '',
    tagIds: [] as string[],
    // Conversation-specific fields
    executionMode: 'sequential' as ConversationExecutionMode,
    delayBetweenTurns: 0,
    simulatedUserModel: 'gpt-4o-mini',
    simulatedUserModelConfig: { temperature: 0.7, maxTokens: 1024 },
    simulatedUserAccessTokenId: '',
    simulatedUserReasoningModel: false,
    simulatedUserReasoningEffort: 'medium',
  });
  const [scenarios, setScenarios] = useState<ScenarioFormItem[]>([]);
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [editingScenarioIdx, setEditingScenarioIdx] = useState<number | null>(null);
  const [scenarioForm, setScenarioForm] = useState({
    name: '',
    personaId: '',
    goal: '',
    maxTurns: 30,
  });
  const [scenarioSubmitAttempted, setScenarioSubmitAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [runningTests, setRunningTests] = useState<Map<string, string>>(new Map());
  const [runProgress, setRunProgress] = useState<Map<string, { completed: number; total: number }>>(new Map());
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });
  const [cancelConfirm, setCancelConfirm] = useState<{
    open: boolean;
    testId: string | null;
  }>({ open: false, testId: null });
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAdvancedModel, setShowAdvancedModel] = useState(false);

  // Drag state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Filter and pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Sorting state
  const [sortBy, setSortBy] = useState<TestsSortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Load supporting data once
  useEffect(() => {
    const loadSupportingData = async () => {
      const [
        tokensRes,
        questionsRes,
        flowConfigsRes,
        webhooksRes,
        evaluatorsRes,
        tagsRes,
        personasRes,
      ] = await Promise.all([
        apiClient.getAccessTokens(),
        apiClient.getQuestionSets(),
        apiClient.getFlowConfigs(),
        apiClient.getWebhooks(),
        apiClient.getLLMJudgeStatus(),
        apiClient.getTags({ limit: 100 }),
        apiClient.getPersonas({ limit: 100 }),
      ]);

      if (tokensRes.success && tokensRes.data) setAccessTokens(tokensRes.data.data);
      if (questionsRes.success && questionsRes.data) setQuestionSets(questionsRes.data.data);
      if (flowConfigsRes.success && flowConfigsRes.data) setFlowConfigs(flowConfigsRes.data.data);
      if (webhooksRes.success && webhooksRes.data) setWebhooks(webhooksRes.data.data);
      if (evaluatorsRes.success && evaluatorsRes.data) setEvaluators(evaluatorsRes.data.evaluators);
      if (tagsRes.success && tagsRes.data) setTags(tagsRes.data.data);
      if (personasRes.success && personasRes.data) setPersonas(personasRes.data.data);

      // Load OpenAI/Anthropic credentials for simulated user
      const [openaiCreds, anthropicCreds] = await Promise.all([
        apiClient.getAccessTokens({ type: 'openai', limit: 100 }),
        apiClient.getAccessTokens({ type: 'anthropic', limit: 100 }),
      ]);
      const creds: StoredAccessToken[] = [];
      if (openaiCreds.success && openaiCreds.data) creds.push(...openaiCreds.data.data);
      if (anthropicCreds.success && anthropicCreds.data) creds.push(...anthropicCreds.data.data);
      setSimulatedUserCredentials(creds);
    };
    loadSupportingData();
  }, []);

  // Load tests with filters and pagination
  const loadTests = useCallback(async () => {
    setIsLoading(true);
    const response = await apiClient.getTests({
      page: currentPage,
      limit: itemsPerPage,
      search: searchTerm || undefined,
      type: (filters.type as TestType) || undefined,
      questionSetId: filters.questionSet || undefined,
      multiStep: filters.multiStep ? filters.multiStep === 'yes' : undefined,
      flowConfigId: filters.flowConfig || undefined,
      tagIds: filters.tag ? [filters.tag] : undefined,
      sortBy,
      sortDirection,
    });

    if (response.success && response.data) {
      setTests(response.data.data);
      setTotalItems(response.data.pagination.total);
      setTotalPages(response.data.pagination.totalPages);
    }
    setIsLoading(false);
  }, [currentPage, itemsPerPage, searchTerm, filters, sortBy, sortDirection]);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Filter definitions for FilterBar
  const filterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'qa', label: 'Q&A' },
          { value: 'conversation', label: 'Conversation' },
        ],
      },
      {
        key: 'questionSet',
        label: 'Question Set',
        type: 'select',
        options: questionSets.map((qs) => ({
          value: qs.id,
          label: qs.name,
          sublabel: `${qs.questions.length} questions`,
        })),
      },
      {
        key: 'flowConfig',
        label: 'Flow Config',
        type: 'select',
        options: flowConfigs.map((fc) => ({
          value: fc.id,
          label: fc.name,
          sublabel: fc.flowId,
        })),
      },
      {
        key: 'tag',
        label: 'Tag',
        type: 'select',
        options: tags.map((tag) => ({
          value: tag.id,
          label: tag.name,
        })),
      },
      {
        key: 'multiStep',
        label: 'Multi-step',
        type: 'select',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
      },
    ],
    [questionSets, flowConfigs, tags]
  );

  const sortOptions: SortOption[] = [
    { value: 'createdAt', label: 'Date Created' },
    { value: 'updatedAt', label: 'Date Updated' },
    { value: 'name', label: 'Name' },
  ];

  const activeFilters: ActiveFilter[] = useMemo(() => {
    const result: ActiveFilter[] = [];
    if (filters.type) {
      result.push({
        key: 'type',
        value: filters.type,
        label: 'Type',
        displayValue: filters.type === 'qa' ? 'Q&A' : 'Conversation',
      });
    }
    if (filters.questionSet) {
      const qs = questionSets.find((q) => q.id === filters.questionSet);
      result.push({
        key: 'questionSet',
        value: filters.questionSet,
        label: 'Question Set',
        displayValue: qs?.name || 'Unknown',
      });
    }
    if (filters.flowConfig) {
      const fc = flowConfigs.find((f) => f.id === filters.flowConfig);
      result.push({
        key: 'flowConfig',
        value: filters.flowConfig,
        label: 'Flow Config',
        displayValue: fc?.name || 'Unknown',
      });
    }
    if (filters.tag) {
      const tag = tags.find((t) => t.id === filters.tag);
      result.push({
        key: 'tag',
        value: filters.tag,
        label: 'Tag',
        displayValue: tag?.name || 'Unknown',
      });
    }
    if (filters.multiStep) {
      result.push({
        key: 'multiStep',
        value: filters.multiStep,
        label: 'Multi-step',
        displayValue: filters.multiStep === 'yes' ? 'Yes' : 'No',
      });
    }
    return result;
  }, [filters, questionSets, flowConfigs, tags]);

  const handleFilterAdd = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleFilterRemove = (key: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({});
    setSortBy('createdAt');
    setSortDirection('desc');
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormSubmitAttempted(true);

    if (!formData.name || !formData.flowConfigId) return;
    if (formData.type === 'conversation' && !formData.simulatedUserModel) return;

    const selectedFlowConfig = flowConfigs.find((fc) => fc.id === formData.flowConfigId);
    if (!selectedFlowConfig) return;

    setLoading(true);

    const data: CreateTestRequest = {
      name: formData.name,
      description: formData.description || undefined,
      type: formData.type,
      flowConfigId: formData.flowConfigId,
      accessTokenId: formData.accessTokenId || null,
      webhookId: formData.webhookId || null,
      evaluatorId: formData.evaluatorId || null,
      tagIds: formData.tagIds,
    };

    if (formData.type === 'qa') {
      data.questionSetId = formData.questionSetId || null;
      data.multiStepEvaluation = formData.multiStepEvaluation;
    } else {
      data.executionMode = formData.executionMode;
      data.delayBetweenTurns = formData.delayBetweenTurns;
      data.simulatedUserModel = formData.simulatedUserModel;
      data.simulatedUserModelConfig = formData.simulatedUserModelConfig;
      data.simulatedUserAccessTokenId = formData.simulatedUserAccessTokenId || null;
      data.simulatedUserReasoningModel = formData.simulatedUserReasoningModel;
      data.simulatedUserReasoningEffort = formData.simulatedUserReasoningModel
        ? formData.simulatedUserReasoningEffort
        : undefined;
      data.scenarios = scenarios.map(({ _tempId, ...s }) => s);
    }

    let response;
    if (editingId) {
      response = await apiClient.updateTest(editingId, data);
    } else {
      response = await apiClient.createTest(data);
    }

    if (response.success) {
      resetForm();
      loadTests();
      showNotification(
        'success',
        editingId ? 'Test updated successfully' : 'Test created successfully'
      );
    } else {
      showNotification('error', response.error || 'Failed to save test');
    }
    setLoading(false);
  };

  const handleEdit = async (test: StoredTest) => {
    setEditingId(test.id);
    setFormData({
      name: test.name,
      description: test.description || '',
      type: test.type || 'qa',
      flowConfigId: test.flowConfigId || '',
      accessTokenId: test.accessTokenId || '',
      questionSetId: test.questionSetId || '',
      multiStepEvaluation: test.multiStepEvaluation,
      webhookId: test.webhookId || '',
      evaluatorId: test.evaluatorId || '',
      tagIds: test.tags?.map((t) => t.id) || [],
      executionMode: test.executionMode || 'sequential',
      delayBetweenTurns: test.delayBetweenTurns || 0,
      simulatedUserModel: test.simulatedUserModel || 'gpt-4o-mini',
      simulatedUserModelConfig: {
        temperature: test.simulatedUserModelConfig?.temperature ?? 0.7,
        maxTokens: test.simulatedUserModelConfig?.maxTokens ?? 1024,
      },
      simulatedUserAccessTokenId: test.simulatedUserAccessTokenId || '',
      simulatedUserReasoningModel: test.simulatedUserReasoningModel || false,
      simulatedUserReasoningEffort: test.simulatedUserReasoningEffort || 'medium',
    });

    if (test.type === 'conversation' && test.scenarios) {
      setScenarios(
        test.scenarios.map((s) => ({
          _tempId: s.id,
          personaId: s.personaId || '',
          name: s.name,
          goal: s.goal,
          maxTurns: s.maxTurns,
        }))
      );
    } else {
      setScenarios([]);
    }

    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'qa',
      flowConfigId: '',
      accessTokenId: '',
      questionSetId: '',
      multiStepEvaluation: false,
      webhookId: '',
      evaluatorId: '',
      tagIds: [],
      executionMode: 'sequential',
      delayBetweenTurns: 0,
      simulatedUserModel: 'gpt-4o-mini',
      simulatedUserModelConfig: { temperature: 0.7, maxTokens: 1024 },
      simulatedUserAccessTokenId: '',
      simulatedUserReasoningModel: false,
      simulatedUserReasoningEffort: 'medium',
    });
    setScenarios([]);
    setShowForm(false);
    setEditingId(null);
    setFormSubmitAttempted(false);
    setShowAdvancedModel(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    const response = await apiClient.deleteTest(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    if (response.success) {
      loadTests();
      showNotification('success', 'Test deleted successfully');
    } else {
      showNotification('error', response.error || 'Failed to delete test');
    }
  };

  const handleRun = async (testId: string, isRetry = false) => {
    if (runningTests.has(testId)) return;

    setRunningTests((prev) => new Map(prev).set(testId, ''));

    const csrfToken = apiClient.getAuthToken();
    if (!csrfToken) {
      setRunningTests((prev) => {
        const next = new Map(prev);
        next.delete(testId);
        return next;
      });
      showNotification('error', 'Not authenticated. Please log in again.');
      return;
    }

    try {
      const response = await fetch(`${apiClient.getApiUrl()}/tests/${testId}/run`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
          Accept: 'text/event-stream',
        },
        credentials: 'include',
      });

      if (response.status === 401 && !isRetry) {
        const refreshResponse = await fetch(`${apiClient.getApiUrl()}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (refreshResponse.ok) {
          setRunningTests((prev) => {
            const next = new Map(prev);
            next.delete(testId);
            return next;
          });
          return handleRun(testId, true);
        } else {
          throw new Error('Session expired. Please log in again.');
        }
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Use default error message
        }
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'run_start' && data.runId) {
                setRunningTests((prev) => new Map(prev).set(testId, data.runId));
                setRunProgress((prev) => new Map(prev).set(testId, { completed: 0, total: data.totalQuestions || data.totalScenarios || 0 }));
              }
              if (data.type === 'result' || data.type === 'scenario:end') {
                setRunProgress((prev) => {
                  const current = prev.get(testId);
                  if (!current) return prev;
                  return new Map(prev).set(testId, { ...current, completed: current.completed + 1 });
                });
              }
              if (data.type === 'complete' || data.type === 'error' || data.type === 'run:error' || data.type === 'canceled') {
                setRunningTests((prev) => {
                  const next = new Map(prev);
                  next.delete(testId);
                  return next;
                });
                setRunProgress((prev) => {
                  const next = new Map(prev);
                  next.delete(testId);
                  return next;
                });
                if (data.type === 'error') {
                  showNotification('error', data.message || 'Test run failed');
                }
                loadTests();
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      setRunningTests((prev) => {
        const next = new Map(prev);
        next.delete(testId);
        return next;
      });
      setRunProgress((prev) => {
        const next = new Map(prev);
        next.delete(testId);
        return next;
      });
      showNotification('error', error instanceof Error ? error.message : 'Failed to run test');
    }
  };

  const handleCancel = async () => {
    if (!cancelConfirm.testId) return;
    const runId = runningTests.get(cancelConfirm.testId);
    if (runId) {
      const response = await apiClient.cancelRun(runId);
      setRunningTests((prev) => {
        const next = new Map(prev);
        next.delete(cancelConfirm.testId!);
        return next;
      });
      if (response.success) {
        loadTests();
        showNotification('success', 'Test run canceled');
      } else {
        showNotification('error', response.error || 'Failed to cancel run');
      }
    }
    setCancelConfirm({ open: false, testId: null });
  };

  const getQuestionSetName = (id?: string) => {
    if (!id) return 'None';
    const qs = questionSets.find((q) => q.id === id);
    return qs?.name || 'Unknown';
  };

  const getAccessTokenName = (id?: string) => {
    if (!id) return 'None';
    const token = accessTokens.find((t) => t.id === id);
    return token?.name || 'Unknown';
  };

  const getWebhookName = (id?: string) => {
    if (!id) return 'None';
    const webhook = webhooks.find((w) => w.id === id);
    return webhook?.name || 'Unknown';
  };

  const getEvaluatorName = (id?: string) => {
    if (!id) return 'None';
    const evaluator = evaluators.find((e) => e.id === id);
    return evaluator?.name || 'Unknown';
  };

  const getPersonaName = (id?: string) => {
    if (!id) return 'No persona';
    const persona = personas.find((p) => p.id === id);
    return persona?.name || 'Unknown';
  };

  const handleExport = async (test: StoredTest) => {
    const response = await apiClient.exportConfig({
      types: ['tests'],
      testIds: [test.id],
    });
    if (response.success && response.data) {
      downloadExportBundle(response.data, generateExportFilename('test', test.name));
      showNotification('success', 'Test exported successfully');
    } else {
      showNotification('error', response.error || 'Failed to export test');
    }
  };

  // Scenario management
  const openAddScenario = () => {
    setScenarioForm({ name: '', personaId: '', goal: '', maxTurns: 30 });
    setEditingScenarioIdx(null);
    setScenarioSubmitAttempted(false);
    setShowScenarioModal(true);
  };

  const openEditScenario = (idx: number) => {
    const s = scenarios[idx];
    setScenarioForm({
      name: s.name,
      personaId: s.personaId,
      goal: s.goal,
      maxTurns: s.maxTurns ?? 30,
    });
    setEditingScenarioIdx(idx);
    setScenarioSubmitAttempted(false);
    setShowScenarioModal(true);
  };

  const handleScenarioSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setScenarioSubmitAttempted(true);
    if (!scenarioForm.name || !scenarioForm.personaId || !scenarioForm.goal) return;

    if (editingScenarioIdx !== null) {
      setScenarios((prev) =>
        prev.map((s, i) =>
          i === editingScenarioIdx
            ? {
                ...s,
                name: scenarioForm.name,
                personaId: scenarioForm.personaId,
                goal: scenarioForm.goal,
                maxTurns: scenarioForm.maxTurns,
              }
            : s
        )
      );
    } else {
      setScenarios((prev) => [
        ...prev,
        {
          _tempId: `temp-${Date.now()}`,
          name: scenarioForm.name,
          personaId: scenarioForm.personaId,
          goal: scenarioForm.goal,
          maxTurns: scenarioForm.maxTurns,
        },
      ]);
    }
    setShowScenarioModal(false);
  };

  const removeScenario = (idx: number) => {
    setScenarios((prev) => prev.filter((_, i) => i !== idx));
  };

  // Drag-and-drop reorder
  const handleDragStart = (idx: number) => {
    dragItem.current = idx;
  };

  const handleDragEnter = (idx: number) => {
    dragOverItem.current = idx;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const from = dragItem.current;
    const to = dragOverItem.current;
    if (from === to) return;

    setScenarios((prev) => {
      const updated = [...prev];
      const [removed] = updated.splice(from, 1);
      updated.splice(to, 0, removed);
      return updated;
    });
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const canRunTest = (test: StoredTest) => {
    if (!test.flowConfigId) return false;
    if (test.type === 'conversation') {
      return (test.scenarios?.length ?? 0) > 0;
    }
    return !!test.questionSetId;
  };

  const getRunDisabledTitle = (test: StoredTest) => {
    if (!test.flowConfigId) return 'No flow config - edit test to add one';
    if (test.type === 'conversation') {
      return (test.scenarios?.length ?? 0) === 0 ? 'No scenarios configured' : 'Run test';
    }
    return !test.questionSetId ? 'No question set configured' : 'Run test';
  };

  const hasActiveFilters = searchTerm || Object.keys(filters).length > 0;

  return (
    <div className={styles.testsPage}>
      <div className={styles.pageHeader}>
        <h2>Tests</h2>
        <div className={styles.headerActions}>
          <button className={styles.importBtn} onClick={() => setShowImportModal(true)}>
            Import
          </button>
          <button className={styles.primaryBtn} onClick={() => setShowForm(true)}>
            + Create Test
          </button>
        </div>
      </div>

      {/* Main test create/edit modal */}
      <Modal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        title={editingId ? 'Edit Test' : 'Create Test'}
        footer={
          <>
            <button className="modal-btn cancel" onClick={resetForm}>
              Cancel
            </button>
            <button className="modal-btn confirm" onClick={() => handleSubmit()} disabled={loading}>
              {loading ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form">
          {/* Test type picker - only show when creating */}
          {!editingId && (
            <div className="form-group">
              <label>Test Type *</label>
              <div className={styles.typePicker}>
                <button
                  type="button"
                  className={`${styles.typeCard} ${formData.type === 'qa' ? styles.typeCardActive : ''}`}
                  onClick={() => setFormData({ ...formData, type: 'qa' })}
                >
                  <span className={styles.typeCardTitle}>Q&A</span>
                  <span className={styles.typeCardDesc}>
                    Test with question sets and evaluate answers
                  </span>
                </button>
                <button
                  type="button"
                  className={`${styles.typeCard} ${formData.type === 'conversation' ? styles.typeCardActive : ''}`}
                  onClick={() => setFormData({ ...formData, type: 'conversation' })}
                >
                  <span className={styles.typeCardTitle}>Conversation</span>
                  <span className={styles.typeCardDesc}>
                    Simulate multi-turn conversations with personas
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Show type badge when editing */}
          {editingId && (
            <div className="form-group">
              <label>Test Type</label>
              <span className={styles.badge}>
                {formData.type === 'qa' ? 'Q&A' : 'Conversation'}
              </span>
            </div>
          )}

          <div className="form-group">
            <label>Test Name *</label>
            <input
              type="text"
              placeholder="e.g., Customer Support Flow Test"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={formSubmitAttempted && !formData.name ? 'input-error' : ''}
            />
            {formSubmitAttempted && !formData.name && (
              <span className="field-error">Test name is required</span>
            )}
          </div>
          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              placeholder="Optional description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Flow Configuration *</label>
            <SearchableSelect
              value={formData.flowConfigId}
              onChange={(value) => setFormData({ ...formData, flowConfigId: value })}
              options={flowConfigs.map((fc) => ({
                value: fc.id,
                label: fc.name,
                sublabel: `${fc.flowId}${fc.basePath ? ` - ${fc.basePath}` : ''}`,
              }))}
              placeholder="Search flow configs..."
              allOptionLabel="Select flow configuration..."
            />
            {formSubmitAttempted && !formData.flowConfigId && (
              <span className="field-error">Flow configuration is required</span>
            )}
            {formData.flowConfigId &&
              (() => {
                const selectedConfig = flowConfigs.find((fc) => fc.id === formData.flowConfigId);
                return selectedConfig ? (
                  <span className="form-hint">
                    Flow ID: {selectedConfig.flowId}
                    {selectedConfig.basePath && ` | Base URL: ${selectedConfig.basePath}`}
                  </span>
                ) : null;
              })()}
          </div>
          <div className="form-group">
            <label>AI Studio Access Token</label>
            <SearchableSelect
              value={formData.accessTokenId}
              onChange={(value) => setFormData({ ...formData, accessTokenId: value })}
              options={accessTokens
                .filter((token) => token.type === 'ai_studio')
                .map((token) => ({
                  value: token.id,
                  label: token.name,
                }))}
              placeholder="Search tokens..."
              allOptionLabel="Select access token..."
            />
          </div>

          {/* Q&A-specific fields */}
          {formData.type === 'qa' && (
            <>
              <div className="form-group">
                <label>Question Set</label>
                <SearchableSelect
                  value={formData.questionSetId}
                  onChange={(value) => setFormData({ ...formData, questionSetId: value })}
                  options={questionSets.map((qs) => ({
                    value: qs.id,
                    label: qs.name,
                    sublabel: `${qs.questions.length} questions`,
                  }))}
                  placeholder="Search question sets..."
                  allOptionLabel="Select question set..."
                />
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.multiStepEvaluation}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        multiStepEvaluation: e.target.checked,
                      })
                    }
                  />
                  Multi-step evaluation (shared session)
                </label>
              </div>
            </>
          )}

          {/* Conversation-specific fields */}
          {formData.type === 'conversation' && (
            <>
              <div className="form-group">
                <label>Execution Mode</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="executionMode"
                      value="sequential"
                      checked={formData.executionMode === 'sequential'}
                      onChange={() => setFormData({ ...formData, executionMode: 'sequential' })}
                    />
                    Sequential
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="executionMode"
                      value="parallel"
                      checked={formData.executionMode === 'parallel'}
                      onChange={() => setFormData({ ...formData, executionMode: 'parallel' })}
                    />
                    Parallel
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label>Simulated User Credential</label>
                <SearchableSelect
                  value={formData.simulatedUserAccessTokenId}
                  onChange={(value) =>
                    setFormData({ ...formData, simulatedUserAccessTokenId: value, simulatedUserModel: '' })
                  }
                  options={simulatedUserCredentials.map((c) => ({
                    value: c.id,
                    label: c.name,
                    sublabel: c.type === 'openai' ? 'OpenAI' : 'Anthropic',
                  }))}
                  placeholder="Search credentials..."
                  allOptionLabel="Select a credential..."
                />
                {simulatedUserCredentials.length === 0 && (
                  <span className="form-hint">
                    No OpenAI or Anthropic credentials found. Add one in Settings &gt; Credentials.
                  </span>
                )}
              </div>
              <div className="form-group">
                <label>Simulated User Model *</label>
                <input
                  type="text"
                  placeholder="Enter model name"
                  value={formData.simulatedUserModel}
                  onChange={(e) => setFormData({ ...formData, simulatedUserModel: e.target.value })}
                  list="simulated-user-model-suggestions"
                  className={
                    formSubmitAttempted && !formData.simulatedUserModel ? 'input-error' : ''
                  }
                />
                {(() => {
                  const selectedCred = simulatedUserCredentials.find(
                    (c) => c.id === formData.simulatedUserAccessTokenId
                  );
                  const suggestions = selectedCred
                    ? MODEL_SUGGESTIONS[selectedCred.type] || []
                    : [];
                  return suggestions.length > 0 ? (
                    <datalist id="simulated-user-model-suggestions">
                      {suggestions.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  ) : null;
                })()}
                {formSubmitAttempted && !formData.simulatedUserModel && (
                  <span className="field-error">Simulated user model is required</span>
                )}
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.simulatedUserReasoningModel}
                    onChange={(e) =>
                      setFormData({ ...formData, simulatedUserReasoningModel: e.target.checked })
                    }
                  />
                  Reasoning model
                </label>
              </div>
              {formData.simulatedUserReasoningModel && (
                <div className="form-group">
                  <label>Reasoning Effort</label>
                  <select
                    value={formData.simulatedUserReasoningEffort}
                    onChange={(e) =>
                      setFormData({ ...formData, simulatedUserReasoningEffort: e.target.value })
                    }
                  >
                    <option value="none">None</option>
                    <option value="minimal">Minimal</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Delay Between Turns (ms)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={formData.delayBetweenTurns}
                  onChange={(e) =>
                    setFormData({ ...formData, delayBetweenTurns: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="form-group">
                <button
                  type="button"
                  className={styles.toggleLink}
                  onClick={() => setShowAdvancedModel(!showAdvancedModel)}
                >
                  {showAdvancedModel ? 'Hide' : 'Show'} advanced model settings
                </button>
                {showAdvancedModel && (
                  <div className={styles.advancedSettings}>
                    <div className="form-group">
                      <label>Temperature: {formData.simulatedUserModelConfig.temperature}</label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={formData.simulatedUserModelConfig.temperature}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            simulatedUserModelConfig: {
                              ...formData.simulatedUserModelConfig,
                              temperature: parseFloat(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>Max Tokens</label>
                      <input
                        type="number"
                        min="1"
                        max="16384"
                        value={formData.simulatedUserModelConfig.maxTokens}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            simulatedUserModelConfig: {
                              ...formData.simulatedUserModelConfig,
                              maxTokens: parseInt(e.target.value) || 1024,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Scenarios section */}
              <div className="form-group">
                <div className={styles.scenarioHeader}>
                  <label>Scenarios ({scenarios.length})</label>
                  <button type="button" className={styles.addScenarioBtn} onClick={openAddScenario}>
                    + Add Scenario
                  </button>
                </div>
                {scenarios.length === 0 ? (
                  <span className="form-hint">
                    No scenarios added yet. Add at least one scenario to run this test.
                  </span>
                ) : (
                  <div className={styles.scenarioList}>
                    {scenarios.map((scenario, idx) => (
                      <div
                        key={scenario._tempId}
                        className={styles.scenarioItem}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragEnter={() => handleDragEnter(idx)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                      >
                        <span className={styles.dragHandle} title="Drag to reorder">
                          &#x2630;
                        </span>
                        <div className={styles.scenarioInfo}>
                          <strong>{scenario.name}</strong>
                          <span className={styles.scenarioMeta}>
                            {getPersonaName(scenario.personaId)} &middot; Max {scenario.maxTurns}{' '}
                            turns
                          </span>
                          <span className={styles.scenarioGoal}>{scenario.goal}</span>
                        </div>
                        <div className={styles.scenarioActions}>
                          <button
                            type="button"
                            onClick={() => openEditScenario(idx)}
                            className={styles.editBtn}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeScenario(idx)}
                            className={styles.deleteBtn}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Shared fields */}
          <div className="form-group">
            <label>Webhook</label>
            <SearchableSelect
              value={formData.webhookId}
              onChange={(value) => setFormData({ ...formData, webhookId: value })}
              options={webhooks
                .filter((w) => w.enabled)
                .map((webhook) => ({
                  value: webhook.id,
                  label: webhook.name,
                }))}
              placeholder="Search webhooks..."
              allOptionLabel="No webhook"
            />
            <span className="form-hint">
              Trigger webhook on run events (running, completed, failed, evaluated)
            </span>
          </div>
          {formData.type === 'qa' && (
            <div className="form-group">
              <label>Auto AI Evaluator</label>
              <SearchableSelect
                value={formData.evaluatorId}
                onChange={(value) => setFormData({ ...formData, evaluatorId: value })}
                options={evaluators.map((ev) => ({
                  value: ev.id,
                  label: ev.name,
                  sublabel: ev.model,
                }))}
                placeholder="Search evaluators..."
                allOptionLabel="No auto-evaluation"
              />
              <span className="form-hint">
                Automatically evaluate results with AI after run completes
              </span>
            </div>
          )}
          <div className="form-group">
            <label>Tags</label>
            <div className="tag-select">
              {tags.map((tag) => (
                <label key={tag.id} className="tag-option">
                  <input
                    type="checkbox"
                    checked={formData.tagIds.includes(tag.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          tagIds: [...formData.tagIds, tag.id],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          tagIds: formData.tagIds.filter((id) => id !== tag.id),
                        });
                      }
                    }}
                  />
                  <span className="tag-chip" style={{ backgroundColor: tag.color || '#3B82F6' }}>
                    {tag.name}
                  </span>
                </label>
              ))}
              {tags.length === 0 && (
                <span className="form-hint">No tags created yet. Create tags in Settings.</span>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* Scenario add/edit modal */}
      <Modal
        isOpen={showScenarioModal}
        onClose={() => setShowScenarioModal(false)}
        onSubmit={handleScenarioSubmit}
        title={editingScenarioIdx !== null ? 'Edit Scenario' : 'Add Scenario'}
        footer={
          <>
            <button className="modal-btn cancel" onClick={() => setShowScenarioModal(false)}>
              Cancel
            </button>
            <button className="modal-btn confirm" onClick={() => handleScenarioSubmit()}>
              {editingScenarioIdx !== null ? 'Update' : 'Add'}
            </button>
          </>
        }
      >
        <form onSubmit={handleScenarioSubmit} className="modal-form">
          <div className="form-group">
            <label>Scenario Name *</label>
            <input
              type="text"
              placeholder="e.g., Password reset - confused user"
              value={scenarioForm.name}
              onChange={(e) => setScenarioForm({ ...scenarioForm, name: e.target.value })}
              className={scenarioSubmitAttempted && !scenarioForm.name ? 'input-error' : ''}
            />
            {scenarioSubmitAttempted && !scenarioForm.name && (
              <span className="field-error">Name is required</span>
            )}
          </div>
          <div className="form-group">
            <label>Persona *</label>
            <SearchableSelect
              value={scenarioForm.personaId}
              onChange={(value) => setScenarioForm({ ...scenarioForm, personaId: value })}
              options={personas.map((p) => ({
                value: p.id,
                label: p.name,
                sublabel: p.isTemplate ? 'Template' : undefined,
              }))}
              placeholder="Search personas..."
              allOptionLabel="Select persona..."
            />
            {scenarioSubmitAttempted && !scenarioForm.personaId && (
              <span className="field-error">Persona is required</span>
            )}
            {personas.length === 0 && (
              <span className="form-hint">
                No personas found. Create one in Settings &gt; Personas first.
              </span>
            )}
          </div>
          <div className="form-group">
            <label>Goal *</label>
            <textarea
              rows={4}
              placeholder="Describe what the simulated user is trying to achieve..."
              value={scenarioForm.goal}
              onChange={(e) => setScenarioForm({ ...scenarioForm, goal: e.target.value })}
              className={scenarioSubmitAttempted && !scenarioForm.goal ? 'input-error' : ''}
            />
            {scenarioSubmitAttempted && !scenarioForm.goal && (
              <span className="field-error">Goal is required</span>
            )}
          </div>
          <div className="form-group">
            <label>Max Turns</label>
            <input
              type="number"
              min="1"
              max="100"
              value={scenarioForm.maxTurns}
              onChange={(e) =>
                setScenarioForm({ ...scenarioForm, maxTurns: parseInt(e.target.value) || 30 })
              }
            />
            <span className="form-hint">
              Maximum number of turns before stopping the conversation
            </span>
          </div>
        </form>
      </Modal>

      <FilterBar
        filters={filterDefinitions}
        activeFilters={activeFilters}
        onFilterAdd={handleFilterAdd}
        onFilterRemove={handleFilterRemove}
        onClearAll={clearFilters}
        searchValue={searchTerm}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search tests..."
        sortOptions={sortOptions}
        sortValue={sortBy}
        sortDirection={sortDirection}
        onSortChange={(value) => {
          setSortBy(value as TestsSortField);
          setCurrentPage(1);
        }}
        onSortDirectionChange={(dir) => {
          setSortDirection(dir);
          setCurrentPage(1);
        }}
      />

      <div className={styles.testsList}>
        {isLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <span className={styles.loadingText}>Loading tests...</span>
          </div>
        ) : totalItems === 0 && !hasActiveFilters ? (
          <div className={styles.emptyState}>
            <p>No tests created yet</p>
            <p className={styles.emptyHint}>
              Create a test to define your flow configuration and question set
            </p>
          </div>
        ) : totalItems === 0 && hasActiveFilters ? (
          <div className={styles.emptyState}>
            <p>No tests match your filters</p>
            <p className={styles.emptyHint}>Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          tests.map((test) => (
            <div key={test.id} className={styles.testCard}>
              <div className={styles.testHeader}>
                <div className={styles.testHeaderLeft}>
                  <h3>{test.name}</h3>
                  <span
                    className={`${styles.typeBadge} ${test.type === 'conversation' ? styles.typeBadgeConversation : styles.typeBadgeQa}`}
                  >
                    {test.type === 'conversation' ? 'Conversation' : 'Q&A'}
                  </span>
                </div>
                <div className={styles.testActions}>
                  {runningTests.has(test.id) ? (
                    <>
                      {runProgress.has(test.id) && (
                        <span className={styles.runProgressText}>
                          {runProgress.get(test.id)!.completed}/{runProgress.get(test.id)!.total}
                        </span>
                      )}
                      <button
                        className={styles.cancelBtn}
                        onClick={() => setCancelConfirm({ open: true, testId: test.id })}
                        disabled={!runningTests.get(test.id)}
                        title={runningTests.get(test.id) ? 'Cancel run' : 'Starting...'}
                      >
                        {runningTests.get(test.id) ? 'Cancel' : 'Starting...'}
                      </button>
                    </>
                  ) : (
                    <button
                      className={styles.runBtn}
                      onClick={() => handleRun(test.id)}
                      disabled={!canRunTest(test)}
                      title={getRunDisabledTitle(test)}
                    >
                      Run
                    </button>
                  )}
                  <button className={styles.editBtn} onClick={() => handleEdit(test)}>
                    Edit
                  </button>
                  <button className={styles.exportBtn} onClick={() => handleExport(test)}>
                    Export
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => setDeleteConfirm({ open: true, id: test.id })}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {test.description && <p className={styles.testDescription}>{test.description}</p>}
              <div className={styles.testDetails}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Flow Config:</span>
                  <span className={styles.detailValue}>
                    {test.flowConfig?.name || (
                      <span className={styles.textMuted}>Not configured</span>
                    )}
                  </span>
                </div>
                {test.flowConfig?.basePath && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Base URL:</span>
                    <span className={styles.detailValue}>{test.flowConfig.basePath}</span>
                  </div>
                )}

                {/* Q&A-specific details */}
                {test.type !== 'conversation' && (
                  <>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Questions:</span>
                      <span className={styles.detailValue}>
                        {getQuestionSetName(test.questionSetId)}
                        {test.questionSet && ` (${test.questionSet.questions.length})`}
                      </span>
                    </div>
                  </>
                )}

                {/* Conversation-specific details */}
                {test.type === 'conversation' && (
                  <>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Scenarios:</span>
                      <span className={styles.detailValue}>
                        {test.scenarios?.length || 0} scenario
                        {(test.scenarios?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Mode:</span>
                      <span className={styles.detailValue}>
                        {test.executionMode || 'sequential'}
                      </span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Model:</span>
                      <span className={styles.detailValue}>
                        {test.simulatedUserModel || 'Not set'}
                      </span>
                    </div>
                  </>
                )}

                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Token:</span>
                  <span className={styles.detailValue}>
                    {getAccessTokenName(test.accessTokenId)}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Webhook:</span>
                  <span className={styles.detailValue}>{getWebhookName(test.webhookId)}</span>
                </div>
                {test.type !== 'conversation' && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Auto Evaluator:</span>
                    <span className={styles.detailValue}>{getEvaluatorName(test.evaluatorId)}</span>
                  </div>
                )}
                {test.tags && test.tags.length > 0 && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Tags:</span>
                    <div className={styles.tagChips}>
                      {test.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className={styles.tagChip}
                          style={{ backgroundColor: tag.color || '#3B82F6' }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {test.type !== 'conversation' && test.multiStepEvaluation && (
                  <div className={styles.detailRow}>
                    <span className={styles.badge}>Multi-step</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={handleItemsPerPageChange}
          itemName="tests"
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Test"
        message="Are you sure you want to delete this test? This will not delete associated runs."
        confirmText="Delete"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={cancelConfirm.open}
        onClose={() => setCancelConfirm({ open: false, testId: null })}
        onConfirm={handleCancel}
        title="Cancel Run"
        message="Are you sure you want to cancel this run? Progress will be saved but the run will be marked as failed."
        confirmText="Cancel Run"
        variant="danger"
      />

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          setShowImportModal(false);
          loadTests();
        }}
        entityType="tests"
        showNotification={showNotification}
      />
    </div>
  );
}
