import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 1,
};

function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    return `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`;
  }
  if (
    (password.match(/[a-z]/g) || []).length < PASSWORD_REQUIREMENTS.minLowercase
  ) {
    return `Password must contain at least ${PASSWORD_REQUIREMENTS.minLowercase} lowercase letter`;
  }
  if (
    (password.match(/[A-Z]/g) || []).length < PASSWORD_REQUIREMENTS.minUppercase
  ) {
    return `Password must contain at least ${PASSWORD_REQUIREMENTS.minUppercase} uppercase letter`;
  }
  if (
    (password.match(/[0-9]/g) || []).length < PASSWORD_REQUIREMENTS.minNumbers
  ) {
    return `Password must contain at least ${PASSWORD_REQUIREMENTS.minNumbers} number`;
  }
  if (
    (password.match(/[^a-zA-Z0-9]/g) || []).length <
    PASSWORD_REQUIREMENTS.minSymbols
  ) {
    return `Password must contain at least ${PASSWORD_REQUIREMENTS.minSymbols} symbol`;
  }
  return null;
}

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const { register, isLoading, error, clearError } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError(null);

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setValidationError(passwordError);
      return;
    }

    const success = await register({
      email,
      password,
      displayName: displayName || undefined,
    });
    if (success) {
      showNotification('success', 'Account created successfully!');
      navigate('/', { replace: true });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (
      e.key === 'Enter' &&
      !isLoading &&
      email &&
      password &&
      confirmPassword
    ) {
      handleSubmit(e);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>
            <span className="logo-bench">Bench</span>
            <span className="logo-mark">Mark</span>
          </h1>
          <h2>Create Account</h2>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {(error || validationError) && (
            <div className="auth-error">{validationError || error}</div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your email"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="displayName">Display Name (optional)</label>
            <input
              type="text"
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Password"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Confirm your password"
              required
            />
          </div>

          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
