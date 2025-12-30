import { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import {
  ConfigurationForm,
  EvaluationResults,
  SessionsPanel,
  FlowExecutor,
  AccessTokensManager,
  QuestionSetsManager,
  FlowConfigsManager,
  EvaluationsManager,
} from './components';
import './app.css';

function EvaluationPage() {
  return (
    <div className="evaluation-page">
      <div className="main-content">
        <div className="left-panel">
          <ConfigurationForm />
          <FlowExecutor />
        </div>
        <div className="right-panel">
          <EvaluationResults />
        </div>
      </div>
      <div className="bottom-panel">
        <SessionsPanel />
      </div>
    </div>
  );
}

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'tokens' | 'questions' | 'flows' | 'evaluations'>('tokens');

  return (
    <div className="settings-page">
      <div className="settings-tabs">
        <button
          className={activeTab === 'tokens' ? 'active' : ''}
          onClick={() => setActiveTab('tokens')}
        >
          Access Tokens
        </button>
        <button
          className={activeTab === 'questions' ? 'active' : ''}
          onClick={() => setActiveTab('questions')}
        >
          Question Sets
        </button>
        <button
          className={activeTab === 'flows' ? 'active' : ''}
          onClick={() => setActiveTab('flows')}
        >
          Flow Configs
        </button>
        <button
          className={activeTab === 'evaluations' ? 'active' : ''}
          onClick={() => setActiveTab('evaluations')}
        >
          Evaluations
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'tokens' && <AccessTokensManager />}
        {activeTab === 'questions' && <QuestionSetsManager />}
        {activeTab === 'flows' && <FlowConfigsManager />}
        {activeTab === 'evaluations' && <EvaluationsManager />}
      </div>
    </div>
  );
}

export function App() {
  const location = useLocation();

  return (
    <AppProvider>
      <div className="app">
        <header className="app-header">
          <h1>Agent Eval</h1>
          <p>AI Flow Evaluation Application</p>
          <nav>
            <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
              Evaluate
            </Link>
            <Link to="/settings" className={location.pathname === '/settings' ? 'active' : ''}>
              Settings
            </Link>
          </nav>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<EvaluationPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </AppProvider>
  );
}

export default App;
