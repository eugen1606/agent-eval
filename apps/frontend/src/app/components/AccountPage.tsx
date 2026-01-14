import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgentEvalClient } from '@agent-eval/api-client';
import { AccountStats } from '@agent-eval/shared';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from './Modal';

const apiClient = new AgentEvalClient();

export function AccountPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
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
    } else {
      setPasswordError(response.error || 'Failed to change password');
    }
    setChangingPassword(false);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const response = await apiClient.deleteAccount();
    if (response.success) {
      logout();
      navigate('/login');
    } else {
      setError(response.error || 'Failed to delete account');
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
      <div className="account-page">
        <div className="loading">Loading account information...</div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="account-page">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <h2>Account</h2>

      {stats && (
        <>
          <section className="account-section">
            <h3>Profile</h3>
            <div className="profile-info">
              <div className="info-row">
                <span className="label">Email</span>
                <span className="value">{stats.user.email}</span>
              </div>
              {stats.user.displayName && (
                <div className="info-row">
                  <span className="label">Display Name</span>
                  <span className="value">{stats.user.displayName}</span>
                </div>
              )}
              <div className="info-row">
                <span className="label">Member Since</span>
                <span className="value">
                  {formatDate(stats.user.createdAt)}
                  <span className="secondary">
                    {' '}
                    ({getDaysSinceJoined(stats.user.createdAt)} days)
                  </span>
                </span>
              </div>
            </div>
          </section>

          <section className="account-section">
            <h3>Usage Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.stats.runsCount}</div>
                <div className="stat-label">Runs</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {stats.stats.questionSetsCount}
                </div>
                <div className="stat-label">Question Sets</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.stats.flowConfigsCount}</div>
                <div className="stat-label">Flow Configs</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {stats.stats.accessTokensCount}
                </div>
                <div className="stat-label">Access Tokens</div>
              </div>
            </div>
          </section>
        </>
      )}

      <section className="account-section">
        <h3>Change Password</h3>
        <form onSubmit={handlePasswordChange} className="password-form">
          <div className="form-group">
            <label>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="form-group">
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
            <div className="error-message">{passwordError}</div>
          )}
          {passwordSuccess && (
            <div className="success-message">{passwordSuccess}</div>
          )}
          <button type="submit" disabled={changingPassword}>
            {changingPassword ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </section>

      <section className="account-section danger-zone">
        <h3>Delete Account</h3>
        <p>
          Deleting your account will permanently remove all your data including
          evaluations, question sets, flow configurations, and access tokens.
        </p>
        <button
          className="delete-btn"
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
