import { Routes, Route, Link } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import {
  ConfigurationForm,
  EvaluationResults,
  SessionsPanel,
  FlowExecutor,
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

export function App() {
  return (
    <AppProvider>
      <div className="app">
        <header className="app-header">
          <h1>Agent Eval</h1>
          <p>AI Flow Evaluation Application</p>
          <nav>
            <Link to="/">Evaluate</Link>
            <Link to="/sessions">Sessions</Link>
          </nav>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<EvaluationPage />} />
            <Route
              path="/sessions"
              element={
                <div className="sessions-page">
                  <SessionsPanel />
                </div>
              }
            />
          </Routes>
        </main>
      </div>
    </AppProvider>
  );
}

export default App;
