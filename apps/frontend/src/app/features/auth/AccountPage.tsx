import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountStats } from '@agent-eval/shared';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '@agent-eval/ui';
import { useNotification } from '../../context/NotificationContext';
import { apiClient } from '../../apiClient';
import styles from './account.module.scss';

export function AccountPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { showNotification } = useNotification();
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAccountStats();
  }, []);

  const loadAccountStats = async () => {
    setLoading(true);
    const response = await apiClient.getAccountStats();
    if (response.success && response.data) {
      setStats(response.data);
    } else {
      setError(response.error || 'Failed to load account stats');
    }
    setLoading(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setChangingPassword(true);
    const response = await apiClient.changePassword({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (response.success) {
      setPasswordSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showNotification('success', 'Password changed successfully');
    } else {
      setPasswordError(response.error || 'Failed to change password');
      showNotification('error', response.error || 'Failed to change password');
    }
    setChangingPassword(false);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const response = await apiClient.deleteAccount();
    if (response.success) {
      showNotification('success', 'Account deleted successfully');
      logout();
      navigate('/login');
    } else {
      setError(response.error || 'Failed to delete account');
      showNotification('error', response.error || 'Failed to delete account');
      setShowDeleteConfirm(false);
    }
    setDeleting(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDaysSinceJoined = (dateString: string) => {
    const joined = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - joined.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading account information...</div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className={styles.page}>
        <div className={styles.errorMessage}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h2>Account</h2>

      {stats && (
        <>
          <section className={styles.section}>
            <h3>Profile</h3>
            <div className={styles.profileInfo}>
              <div className={styles.infoRow}>
                <span className={styles.label}>Email</span>
                <span className={styles.value}>{stats.user.email}</span>
              </div>
              {stats.user.displayName && (
                <div className={styles.infoRow}>
                  <span className={styles.label}>Display Name</span>
                  <span className={styles.value}>{stats.user.displayName}</span>
                </div>
              )}
              <div className={styles.infoRow}>
                <span className={styles.label}>Member Since</span>
                <span className={styles.value}>
                  {formatDate(stats.user.createdAt)}
                  <span className={styles.secondary}>
                    {' '}
                    ({getDaysSinceJoined(stats.user.createdAt)} days)
                  </span>
                </span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Usage Statistics</h3>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{stats.stats.runsCount}</div>
                <div className={styles.statLabel}>Runs</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>
                  {stats.stats.questionSetsCount}
                </div>
                <div className={styles.statLabel}>Question Sets</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{stats.stats.flowConfigsCount}</div>
                <div className={styles.statLabel}>Flow Configs</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>
                  {stats.stats.accessTokensCount}
                </div>
                <div className={styles.statLabel}>Access Tokens</div>
              </div>
            </div>
          </section>
        </>
      )}

      <section className={styles.section}>
        <h3>Change Password</h3>
        <form onSubmit={handlePasswordChange} className={styles.passwordForm}>
          <div className={styles.formGroup}>
            <label>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className={styles.formGroup}>
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {passwordError && (
            <div className={styles.errorMessage}>{passwordError}</div>
          )}
          {passwordSuccess && (
            <div className={styles.successMessage}>{passwordSuccess}</div>
          )}
          <button type="submit" disabled={changingPassword}>
            {changingPassword ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </section>

      <section className={`${styles.section} ${styles.dangerZone}`}>
        <h3>Delete Account</h3>
        <p>
          Deleting your account will permanently remove all your data including
          evaluations, question sets, flow configurations, and access tokens.
        </p>
        <button
          className={styles.deleteBtn}
          onClick={() => setShowDeleteConfirm(true)}
        >
          Delete Account
        </button>
      </section>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        message="Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted."
        confirmText={deleting ? 'Deleting...' : 'Delete Account'}
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
