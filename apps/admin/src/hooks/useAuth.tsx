import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'dev-secret-change-me';

interface User {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  createdAt?: string;
  lastSeen?: string;
  userMeta?: Record<string, any>;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  isSuperAdmin: () => boolean;
  signin: (credentials: { email: string; remember?: boolean }) => Promise<void>;
  signup: (data: { name: string; email: string; role?: string }) => Promise<void>;
  signout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load token from memory (fallback if cookies don't work)
  // In production, prefer HttpOnly cookies set by backend
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const fetchUser = async (authToken?: string) => {
    // Only use provided token, don't fallback to ADMIN_SECRET automatically
    // This prevents auto-authentication on auth pages
    const tokenToUse = authToken || token;
    
    if (!tokenToUse) {
      setUser(null);
      return null;
    }
    
    try {
      const res = await fetch(`${API_BASE}/me`, {
        headers: {
          'Authorization': `Bearer ${tokenToUse}`
        },
        credentials: 'include' // Include cookies
      });

      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        return userData;
      } else {
        // For backward compatibility: if using ADMIN_SECRET and /me fails, 
        // create dev admin user (old dev mode behavior)
        if (tokenToUse === ADMIN_SECRET) {
          const devUser = {
            userId: 'dev-admin',
            email: 'dev@admin.local',
            name: 'Dev Admin',
            roles: ['super_admin']
          };
          setUser(devUser);
          return devUser;
        }
        // Clear invalid token
        setToken(null);
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
        setUser(null);
        return null;
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      // For backward compatibility: if using ADMIN_SECRET, create dev admin user
      if (tokenToUse === ADMIN_SECRET) {
        const devUser = {
          userId: 'dev-admin',
          email: 'dev@admin.local',
          name: 'Dev Admin',
          roles: ['super_admin']
        };
        setUser(devUser);
        return devUser;
      }
      setUser(null);
      return null;
    }
  };

  // Initial load: check for existing session
  useEffect(() => {
    const initAuth = async () => {
      // Check if we have a stored token first
      const storedToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      
      // Only try to fetch user if we have a token
      // Don't auto-authenticate with dev-admin on initial load
      if (storedToken) {
        await fetchUser(storedToken);
      } else {
        // No stored token, set loading to false without setting user
        setUser(null);
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const signin = async (credentials: { email: string; remember?: boolean }) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify(credentials)
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(error.error || 'Login failed');
    }

    const data = await res.json();
    
    // Store token in memory as fallback (backend sets HttpOnly cookie)
    // In production, prefer cookies, but keep memory storage as fallback
    if (data.token) {
      setToken(data.token);
      if (credentials.remember) {
        localStorage.setItem('auth_token', data.token);
      } else {
        sessionStorage.setItem('auth_token', data.token);
      }
    }

    // Fetch user details
    const userData = await fetchUser(data.token);
    if (!userData) {
      throw new Error('Failed to load user profile');
    }
  };

  const signup = async (signupData: { name: string; email: string; role?: string }) => {
    // Include role if provided (any user can now select their role)
    const payload: any = {
      name: signupData.name,
      email: signupData.email,
      role: signupData.role || 'viewer' // Always include role, default to viewer
    };

    console.log('📤 Signup payload being sent to API:', payload);

    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Signup failed' }));
      throw new Error(error.error || 'Signup failed');
    }

    // Signup successful, user needs to sign in
    return;
  };

  const signout = async () => {
    // Clear token from memory
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');

    // In production, call backend logout endpoint to clear HttpOnly cookie
    // For now, just clear client-side state
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      }).catch(() => {
        // Ignore errors, logout is best-effort
      });
    } catch (err) {
      // Ignore
    }
  };

  const refreshMe = async () => {
    await fetchUser();
  };

  const hasRole = (role: string): boolean => {
    if (!user) return false;
    return user.roles.includes(role) || user.roles.includes('super_admin');
  };

  const hasAnyRole = (roles: string[]): boolean => {
    if (!user) return false;
    return roles.some(role => hasRole(role));
  };

  const isSuperAdmin = (): boolean => {
    return hasRole('super_admin');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      hasRole, 
      hasAnyRole, 
      isSuperAdmin,
      signin, 
      signup, 
      signout, 
      refreshMe 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Protected Route wrapper component
interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string | string[];
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, hasRole, hasAnyRole } = useAuth();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        setShouldRedirect(true);
      } else if (requiredRole) {
        const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
        if (!hasAnyRole(roles)) {
          setShouldRedirect(true);
        }
      }
    }
  }, [user, loading, requiredRole, hasRole, hasAnyRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (shouldRedirect) {
    window.location.href = '/auth';
    return null;
  }

  return <>{children}</>;
}
