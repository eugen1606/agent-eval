import { useState } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { ConfirmDialog } from '@agent-eval/ui';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { AccountPage } from './features/auth/AccountPage';
import { TestsPage } from './features/tests/TestsPage';
import { RunsPage } from './features/runs/RunsPage';
import { RunDetailPage } from './features/runs/RunDetailPage';
import { RunComparisonPage } from './features/runs/RunComparisonPage';
import { Dashboard } from './features/dashboard/Dashboard';
import { Homepage } from './features/dashboard/Homepage';
import { AccessTokensManager } from './features/settings/AccessTokensManager';
import { QuestionSetsManager } from './features/settings/QuestionSetsManager';
import { FlowConfigsManager } from './features/settings/FlowConfigsManager';
import { WebhooksManager } from './features/settings/WebhooksManager';
import { TagManager } from './features/settings/TagManager';
import { EvaluatorsManager } from './features/settings/EvaluatorsManager';
import { PersonasManager } from './features/settings/PersonasManager';
import { ScheduledTestsPage } from './features/scheduled-tests/ScheduledTestsPage';
import { ProtectedRoute } from './shared/ProtectedRoute';
import './app.css';

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    'tokens' | 'questions' | 'flows' | 'webhooks' | 'tags' | 'evaluators' | 'personas'
  >('tokens');

  return (
    <div className="settings-page">
      <div className="settings-tabs">
        <button
          className={activeTab === 'tokens' ? 'active' : ''}
          onClick={() => setActiveTab('tokens')}
        >
          Credentials
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
        <button
          className={activeTab === 'tags' ? 'active' : ''}
          onClick={() => setActiveTab('tags')}
        >
          Tags
        </button>
        <button
          className={activeTab === 'evaluators' ? 'active' : ''}
          onClick={() => setActiveTab('evaluators')}
        >
          Evaluators
        </button>
        <button
          className={activeTab === 'personas' ? 'active' : ''}
          onClick={() => setActiveTab('personas')}
        >
          Personas
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'tokens' && <AccessTokensManager />}
        {activeTab === 'questions' && <QuestionSetsManager />}
        {activeTab === 'flows' && <FlowConfigsManager />}
        {activeTab === 'webhooks' && <WebhooksManager />}
        {activeTab === 'tags' && <TagManager />}
        {activeTab === 'evaluators' && <EvaluatorsManager />}
        {activeTab === 'personas' && <PersonasManager />}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
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

// Layout component for authenticated pages with header
function AppLayout() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="logo-link">
          <h1>
            <span className="logo-bench">Bench</span>
            <span className="logo-mark">Mark</span>
          </h1>
        </Link>
        <p>Agent Evaluation <span className="app-version">v{__APP_VERSION__}</span></p>
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
            className={location.pathname.startsWith('/dashboard') ? 'active' : ''}
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
        <Outlet />
      </main>
    </div>
  );
}

// Create the router with data router API
const router = createBrowserRouter([
  // Auth pages without layout
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  // Main app with layout
  {
    element: <AppLayout />,
    children: [
      {
        path: '/',
        element: (
          <ProtectedRoute>
            <Homepage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/tests',
        element: (
          <ProtectedRoute>
            <TestsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/runs',
        element: (
          <ProtectedRoute>
            <RunsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/runs/:id',
        element: (
          <ProtectedRoute>
            <RunDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/runs/:id/compare/:otherId',
        element: (
          <ProtectedRoute>
            <RunComparisonPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/scheduled',
        element: (
          <ProtectedRoute>
            <ScheduledTestsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/dashboard',
        element: (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: '/settings',
        element: (
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/account',
        element: (
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

// Inner component that provides the router
function AppWithRouter() {
  return <RouterProvider router={router} />;
}

export function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          <AppWithRouter />
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
