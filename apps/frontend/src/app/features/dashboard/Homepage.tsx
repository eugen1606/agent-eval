import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './dashboard.module.scss';

export function Homepage() {
  const { user } = useAuth();

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';

  return (
    <div className={styles.homePage}>
      <h2>Welcome back, {displayName}!</h2>
      <p className={styles.tagline}>
        Ready to evaluate your AI flows with <span className="logo-bench">Bench</span><span className="logo-mark">Mark</span>
      </p>

      <div className={styles.cards}>
        <Link to="/tests" className={styles.card}>
          <div className={styles.cardIcon}>&#9654;</div>
          <h3>Run Tests</h3>
          <p>Create and execute test configurations against AI flows</p>
        </Link>

        <Link to="/dashboard" className={styles.card}>
          <div className={styles.cardIcon}>&#128200;</div>
          <h3>Dashboard</h3>
          <p>View evaluation statistics and analyze problem areas</p>
        </Link>

        <Link to="/settings" className={styles.card}>
          <div className={styles.cardIcon}>&#9881;</div>
          <h3>Settings</h3>
          <p>Manage tokens, question sets, flow configs, and evaluations</p>
        </Link>
      </div>

      <div className={styles.features}>
        <h3>Features</h3>
        <div className={styles.featuresList}>
          <div className={styles.featureItem}>
            <span className={styles.featureIcon}>&#128269;</span>
            <div className={styles.featureText}>
              <strong>Flow Execution</strong>
              <span>Execute AI flows with customizable question sets</span>
            </div>
          </div>

          <div className={styles.featureItem}>
            <span className={styles.featureIcon}>&#9989;</span>
            <div className={styles.featureText}>
              <strong>Human Evaluation</strong>
              <span>Mark responses as correct, partial, or incorrect</span>
            </div>
          </div>

          <div className={styles.featureItem}>
            <span className={styles.featureIcon}>&#128202;</span>
            <div className={styles.featureText}>
              <strong>Visual Analytics</strong>
              <span>Pie charts and statistics for evaluation results</span>
            </div>
          </div>

          <div className={styles.featureItem}>
            <span className={styles.featureIcon}>&#128190;</span>
            <div className={styles.featureText}>
              <strong>Evaluation History</strong>
              <span>Save and review past evaluations</span>
            </div>
          </div>

          <div className={styles.featureItem}>
            <span className={styles.featureIcon}>&#128274;</span>
            <div className={styles.featureText}>
              <strong>Secure Token Storage</strong>
              <span>Encrypted storage for API access tokens</span>
            </div>
          </div>

          <div className={styles.featureItem}>
            <span className={styles.featureIcon}>&#128229;</span>
            <div className={styles.featureText}>
              <strong>Export Options</strong>
              <span>Export results to JSON or CSV formats</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
