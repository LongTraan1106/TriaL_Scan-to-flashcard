import React, { createContext, useState, useCallback, useEffect } from 'react';
import { authService, SignUpRequest, SignInRequest, UserResponse } from '../services/authService';
import { storageService } from '../utils/storageService';

export interface AuthContextType {
  // State
  isLoggedIn: boolean;
  user: UserResponse | null;
  loading: boolean;
  authLoading: boolean;
  error: string | null;
  accessToken: string | null;
  refreshToken: string | null;

  // Methods
  signUp: (data: SignUpRequest) => Promise<void>;
  signIn: (data: SignInRequest) => Promise<void>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<UserResponse | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  /**
   * Check if user is already logged in (restore session)
   */
  const checkAuthStatus = useCallback(async () => {
    try {
      setAuthLoading(true);
      setError(null);

      const authData = await storageService.getAllAuthData();
      const validAccessToken = await storageService.getAccessToken();

      if (validAccessToken && authData.userData) {
        const latestUserData = await authService.getCurrentUser(validAccessToken);
        await storageService.saveUserData(latestUserData);
        setAccessToken(validAccessToken);
        setRefreshToken(authData.refreshToken);
        setUser(latestUserData);
        setIsLoggedIn(true);
      } else {
        await storageService.clearAuthData();
        setIsLoggedIn(false);
      }
    } catch (err) {
      console.error('Error checking auth status:', err);
      setIsLoggedIn(false);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const validAccessToken = await storageService.getAccessToken();
      if (!validAccessToken) {
        return;
      }

      const latestUserData = await authService.getCurrentUser(validAccessToken);
      await storageService.saveUserData(latestUserData);
      setUser(latestUserData);
      setAccessToken(validAccessToken);
    } catch (err) {
      console.error('Error refreshing user:', err);
    }
  }, []);

  /**
   * Sign Up
   * Constraints from backend:
   * - username: 3-20 chars, only a-z, A-Z, 0-9, _
   * - email: must be @gmail.com
   * - password: min 6 chars, must have 1 uppercase + 1 number
   */
  const signUp = useCallback(async (data: SignUpRequest) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authService.signUp(data);

      if (!response.success) {
        throw new Error(response.message || 'Sign up failed');
      }

      // Sign up successful - user will navigate to SignIn after viewing success modal
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign up failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Sign In
   * Backend uses EMAIL for sign in, not username!
   */
  const signIn = useCallback(async (data: SignInRequest) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authService.signIn(data);

      if (!response.success) {
        throw new Error(response.message || 'Sign in failed');
      }

      if (!response.data || !response.data.user || !response.data.tokens) {
        throw new Error('Invalid response from server');
      }

      const { user: userData, tokens } = response.data;

      // Save tokens and user data
      await storageService.saveAccessToken(tokens.access_token);
      await storageService.saveRefreshToken(tokens.refresh_token);
      await storageService.saveUserData(userData);

      // Update state
      setAccessToken(tokens.access_token);
      setRefreshToken(tokens.refresh_token);
      setUser(userData);
      setIsLoggedIn(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign in failed';
      setError(errorMessage);
      setIsLoggedIn(false);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Call backend logout endpoint if we have a refresh token
      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      // Clear all auth data from storage
      await storageService.clearAuthData();

      // Clear state
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
      setIsLoggedIn(false);
    } catch (err) {
      console.error('Error during logout:', err);
      // Still clear state even if something fails
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  }, [refreshToken]);

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Check auth status on app launch
   */
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const value: AuthContextType = {
    isLoggedIn,
    user,
    loading,
    authLoading,
    error,
    accessToken,
    refreshToken,
    signUp,
    signIn,
    logout,
    checkAuthStatus,
    refreshUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to use AuthContext
 */
export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
