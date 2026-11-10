import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/** API base URL */
const API_BASE = 'http://localhost:8000';

/** User info from JWT */
export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

/** Auth context state */
interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  getAuthHeader: () => { Authorization: string } | {};
}

/** Auth context */
const AuthContext = createContext<AuthContextValue | null>(null);

/** Check if JWT is expired (without verifying signature) */
function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return true;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.exp ? decoded.exp * 1000 < Date.now() : true;
  } catch {
    return true;
  }
}

/** Get token from localStorage */
function getStoredToken(): string | null {
  return localStorage.getItem('tc_token');
}

/** Clear all auth-related localStorage */
function clearAuthStorage(): void {
  localStorage.removeItem('tc_token');
  localStorage.removeItem('tc_failed_attempts');
}

/** Provider component */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getStoredToken();
      if (storedToken) {
        if (isTokenExpired(storedToken)) {
          console.log('[Auth] Token expired on init, clearing...');
          clearAuthStorage();
          setToken(null);
          setUser(null);
        } else {
          setToken(storedToken);
          // Fetch user info to validate token
          try {
            await fetchUser(storedToken);
          } catch {
            // Token invalid, clear it
            clearAuthStorage();
            setToken(null);
            setUser(null);
          }
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  /** Fetch user info from /auth/me */
  const fetchUser = useCallback(async (authToken: string): Promise<User | null> => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch user');
      const data = await res.json();
      const userData = data.user;
      setUser(userData);
      return userData;
    } catch (err) {
      console.error('[Auth] Failed to fetch user:', err);
      return null;
    }
  }, []);

  /** Login - store token and fetch user */
  const login = useCallback(async (newToken: string, userData?: User) => {
    if (isTokenExpired(newToken)) {
      console.warn('[Auth] Attempted to login with expired token');
      return;
    }
    localStorage.setItem('tc_token', newToken);
    setToken(newToken);
    if (userData) {
      setUser(userData);
    } else {
      await fetchUser(newToken);
    }
  }, [fetchUser]);

  /** Logout - clear everything and redirect to login */
  const logout = useCallback(() => {
    clearAuthStorage();
    setToken(null);
    setUser(null);
    navigate('/masuk', { replace: true });
  }, [navigate]);

  /** Refresh user info (e.g., after profile update) */
  const refreshUser = useCallback(async () => {
    if (token) {
      await fetchUser(token);
    }
  }, [token, fetchUser]);

  /** Get auth header for API calls */
  const getAuthHeader = useCallback(() => {
    if (token && !isTokenExpired(token)) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }, [token]);

  // Auto-logout on token expiration - check periodically
  useEffect(() => {
    if (!token) return;

    const checkExpiry = () => {
      if (isTokenExpired(token)) {
        console.log('[Auth] Token expired during session, logging out...');
        logout();
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkExpiry, 30_000);
    return () => clearInterval(interval);
  }, [token, logout]);

  // Intercept fetch to auto-handle 401
  useEffect(() => {
    if (!token) return;

    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      
      // Only add auth header for API calls
      if (url.startsWith(API_BASE) && token) {
        const headers = new Headers(init?.headers);
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        init = { ...init, headers };
      }

      const response = await originalFetch(input, init);

      // Handle 401 - token expired or invalid
      if (response.status === 401 && url.startsWith(API_BASE)) {
        console.log('[Auth] Received 401, logging out...');
        logout();
        // Redirect will happen in logout
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!user && !!token,
      isLoading,
      login,
      logout,
      refreshUser,
      getAuthHeader,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Hook to use auth context */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

/** Hook for API calls with automatic auth header */
export function useApi() {
  const { getAuthHeader, logout } = useAuth();

  const apiCall = useCallback(async <T,>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const headers = new Headers(options.headers);
    const authHeader = getAuthHeader();
    if (authHeader.Authorization) {
      headers.set('Authorization', authHeader.Authorization);
    }
    headers.set('Content-Type', 'application/json');

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      logout();
      throw new Error('Sesi berakhir. Silakan login ulang.');
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Terjadi kesalahan.');
    }
    return data as T;
  }, [getAuthHeader, logout]);

  return { apiCall };
}