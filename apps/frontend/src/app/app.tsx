import { useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import {
  ConfigurationForm,
  EvaluationResults,
  SessionsPanel,
  FlowExecutor,
  AccessTokensManager,
  QuestionSetsManager,
  FlowConfigsManager,
  EvaluationsManager,
  Dashboard,
  Homepage,
  LoginPage,
  RegisterPage,
  ProtectedRoute,
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
  const [activeTab, setActiveTab] = useState<
    'tokens' | 'questions' | 'flows' | 'evaluations'
  >('tokens');

  return (
    <div className="settings-page">
      <div className="settings-tabs">
        <button
          className={activeTab === 'tokens' ? 'active' : ''}
          onClick={() => setActiveTab('tokens')}
        >
          AI Studio Access Tokens
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

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="user-menu">
      <span className="user-email">{user.displayName || user.email}</span>
      <button onClick={handleLogout} className="logout-button">
        Logout
      </button>
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Don't show header on auth pages
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    );
  }

  return (
    <AppProvider>
      <div className="app">
        <header className="app-header">
          <Link to="/" className="logo-link">
            <h1>
              <span className="logo-bench">Bench</span>
              <span className="logo-mark">Mark</span>
            </h1>
          </Link>
          <p>Agent Evaluation</p>
          <nav>
            <Link
              to="/evaluate"
              className={location.pathname === '/evaluate' ? 'active' : ''}
            >
              Evaluate
            </Link>
            <Link
              to="/dashboard"
              className={
                location.pathname.startsWith('/dashboard') ? 'active' : ''
              }
            >
              Dashboard
            </Link>
            <Link
              to="/settings"
              className={location.pathname === '/settings' ? 'active' : ''}
            >
              Settings
            </Link>
          </nav>
          {isAuthenticated && <UserMenu />}
        </header>

        <main className="app-main">
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Homepage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/evaluate"
              element={
                <ProtectedRoute>
                  <EvaluationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </AppProvider>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
