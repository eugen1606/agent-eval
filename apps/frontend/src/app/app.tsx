import { useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import {
  AccessTokensManager,
  QuestionSetsManager,
  FlowConfigsManager,
  WebhooksManager,
  Dashboard,
  Homepage,
  LoginPage,
  RegisterPage,
  ProtectedRoute,
  AccountPage,
  ConfirmDialog,
  TestsPage,
  RunsPage,
  RunDetailPage,
  ScheduledTestsPage,
} from './components';
import './app.css';

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    'tokens' | 'questions' | 'flows' | 'webhooks'
  >('tokens');

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
          className={activeTab === 'webhooks' ? 'active' : ''}
          onClick={() => setActiveTab('webhooks')}
        >
          Webhooks
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'tokens' && <AccessTokensManager />}
        {activeTab === 'questions' && <QuestionSetsManager />}
        {activeTab === 'flows' && <FlowConfigsManager />}
        {activeTab === 'webhooks' && <WebhooksManager />}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme} className="theme-toggle" title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
      {theme === 'light' ? '\u263D' : '\u2600'}
    </button>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="user-menu">
      <ThemeToggle />
      <Link to="/account" className="user-email-link">
        {user.displayName || user.email}
      </Link>
      <button onClick={() => setShowLogoutConfirm(true)} className="logout-button">
        Logout
      </button>
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
      />
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
              to="/tests"
              className={location.pathname === '/tests' ? 'active' : ''}
            >
              Tests
            </Link>
            <Link
              to="/runs"
              className={location.pathname.startsWith('/runs') ? 'active' : ''}
            >
              Runs
            </Link>
            <Link
              to="/scheduled"
              className={location.pathname === '/scheduled' ? 'active' : ''}
            >
              Scheduled
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
              path="/tests"
              element={
                <ProtectedRoute>
                  <TestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/runs"
              element={
                <ProtectedRoute>
                  <RunsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/runs/:id"
              element={
                <ProtectedRoute>
                  <RunDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/scheduled"
              element={
                <ProtectedRoute>
                  <ScheduledTestsPage />
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
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
