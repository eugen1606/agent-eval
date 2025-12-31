import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginRequest, RegisterRequest } from '@agent-eval/shared';
import { createClient } from '@agent-eval/api-client';

const apiClient = createClient();

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<boolean>;
  register: (data: RegisterRequest) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing auth on mount
    checkAuth();
  }, []);

  const checkAuth = async () => {
    if (apiClient.isAuthenticated()) {
      const result = await apiClient.getMe();
      if (result.success && result.data) {
        setUser(result.data);
      } else {
        // Token expired or invalid
        apiClient.logout();
      }
    }
    setIsLoading(false);
  };

  const login = async (credentials: LoginRequest): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    const result = await apiClient.login(credentials);

    if (result.success && result.data) {
      setUser(result.data.user);
      setIsLoading(false);
      return true;
    } else {
      setError(result.error || 'Login failed');
      setIsLoading(false);
      return false;
    }
  };

  const register = async (data: RegisterRequest): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    const result = await apiClient.register(data);

    if (result.success && result.data) {
      setUser(result.data.user);
      setIsLoading(false);
      return true;
    } else {
      setError(result.error || 'Registration failed');
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    apiClient.logout();
    setUser(null);
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
