import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  FlowConfig,
  QuestionInput,
  EvaluationResult,
  EvaluationSession,
} from '@agent-eval/shared';

interface AppState {
  config: FlowConfig;
  questions: QuestionInput[];
  results: EvaluationResult[];
  currentSession: EvaluationSession | null;
  isLoading: boolean;
  error: string | null;
  loadedEvaluationId: string | null; // ID of evaluation being continued
  selectedQuestionSetId: string | null; // ID of question set used for evaluation
}

interface AppContextType {
  state: AppState;
  setConfig: (config: FlowConfig) => void;
  setQuestions: (questions: QuestionInput[]) => void;
  setResults: (results: EvaluationResult[]) => void;
  addResult: (result: EvaluationResult) => void;
  clearResults: () => void;
  setCurrentSession: (session: EvaluationSession | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateResult: (id: string, updates: Partial<EvaluationResult>) => void;
  loadEvaluation: (evaluationId: string, config: FlowConfig, results: EvaluationResult[]) => void;
  clearLoadedEvaluation: () => void;
  setSelectedQuestionSetId: (id: string | null) => void;
}

const initialState: AppState = {
  config: {
    accessToken: '',
    basePath: '',
    flowId: '',
    multiStepEvaluation: false,
  },
  questions: [],
  results: [],
  currentSession: null,
  isLoading: false,
  error: null,
  loadedEvaluationId: null,
  selectedQuestionSetId: null,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);

  const setConfig = (config: FlowConfig) => {
    setState((prev) => ({ ...prev, config }));
  };

  const setQuestions = (questions: QuestionInput[]) => {
    setState((prev) => ({ ...prev, questions }));
  };

  const setResults = (results: EvaluationResult[]) => {
    setState((prev) => ({ ...prev, results }));
  };

  const addResult = (result: EvaluationResult) => {
    setState((prev) => ({ ...prev, results: [...prev.results, result] }));
  };

  const clearResults = () => {
    setState((prev) => ({ ...prev, results: [] }));
  };

  const setCurrentSession = (session: EvaluationSession | null) => {
    setState((prev) => ({ ...prev, currentSession: session }));
  };

  const setLoading = (isLoading: boolean) => {
    setState((prev) => ({ ...prev, isLoading }));
  };

  const setError = (error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  };

  const updateResult = (id: string, updates: Partial<EvaluationResult>) => {
    setState((prev) => ({
      ...prev,
      results: prev.results.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    }));
  };

  const loadEvaluation = (evaluationId: string, config: FlowConfig, results: EvaluationResult[]) => {
    setState((prev) => ({
      ...prev,
      config,
      results,
      loadedEvaluationId: evaluationId,
      error: null,
    }));
  };

  const clearLoadedEvaluation = () => {
    setState((prev) => ({
      ...prev,
      loadedEvaluationId: null,
    }));
  };

  const setSelectedQuestionSetId = (id: string | null) => {
    setState((prev) => ({ ...prev, selectedQuestionSetId: id }));
  };

  return (
    <AppContext.Provider
      value={{
        state,
        setConfig,
        setQuestions,
        setResults,
        addResult,
        clearResults,
        setCurrentSession,
        setLoading,
        setError,
        updateResult,
        loadEvaluation,
        clearLoadedEvaluation,
        setSelectedQuestionSetId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
