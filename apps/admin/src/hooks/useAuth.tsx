import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import PermissionDeniedPage from '../pages/PermissionDeniedPage';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'dev-secret-change-me';

// Safe storage helpers so that browsers which block storage (privacy mode, 3rd‑party iframes, etc.)
// do not throw and break the auth flow.
function safeStorageGetToken(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('auth_token') || window.sessionStorage.getItem('auth_token');
  } catch (err) {
    console.warn('Storage access blocked when reading auth_token:', err);
    return null;
  }
}

function safeStorageSetToken(token: string, remember?: boolean) {
  try {
    if (typeof window === 'undefined') return;
    if (remember) {
      window.localStorage.setItem('auth_token', token);
    } else {
      window.sessionStorage.setItem('auth_token', token);
    }
  } catch (err) {
    console.warn('Storage access blocked when writing auth_token:', err);
    // Continue with in‑memory token only
  }
}

function safeStorageClearToken() {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem('auth_token');
    window.sessionStorage.removeItem('auth_token');
  } catch (err) {
    console.warn('Storage access blocked when clearing auth_token:', err);
  }
}

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
  isAdmin: () => boolean;
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
    const storedToken = safeStorageGetToken();
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const fetchUser = async (authToken?: string) => {
    // Only use explicit token (override, state, or from storage).
    // Do NOT fall back to ADMIN_SECRET automatically for normal auth.
    const tokenToUse = authToken || token || safeStorageGetToken();

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
            roles: ['admin']
          };
          setUser(devUser);
          return devUser;
        }
        // Clear invalid token
        setToken(null);
        safeStorageClearToken();
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
          roles: ['admin']
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
      // Try to get a stored token first (may be blocked by browser privacy settings)
      const storedToken = safeStorageGetToken();

      // Only try to fetch user if we have a token;
      // don't auto-authenticate with dev-admin on initial load.
      if (storedToken) {
        const userData = await fetchUser(storedToken);
        
        // Auto-connect agent to Socket.IO if they have agent role and are already logged in
        if (userData && userData.roles && userData.roles.includes('agent') && typeof window !== 'undefined') {
          try {
            const { io } = await import('socket.io-client');
            const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE || 'http://localhost:4000';
            const socket = io(SOCKET_URL, {
              withCredentials: true,
              transports: ['websocket', 'polling']
            });
            
            socket.on('connect', () => {
              console.log('🔌 Agent auto-connected to Socket.IO for online status (on page load)');
              // Authenticate as agent using userId
              socket.emit('agent_auth', {
                token: storedToken,
                agentId: userData.userId
              });
            });
            
            socket.on('agent_connected', (data: any) => {
              console.log('✅ Agent authenticated successfully:', data);
            });
            
            socket.on('auth_error', (error: any) => {
              console.error('❌ Agent authentication failed:', error);
            });
            
            socket.on('disconnect', () => {
              console.log('🔌 Agent Socket disconnected');
            });
            
            // If socket is already connected, authenticate immediately
            if (socket.connected) {
              console.log('🔌 Socket already connected, authenticating immediately');
              socket.emit('agent_auth', {
                token: storedToken,
                agentId: userData.userId
              });
            }
            
            // Store socket reference
            (window as any).__agentSocket = socket;
          } catch (err) {
            console.warn('Failed to auto-connect agent to Socket.IO:', err);
          }
        }
      } else {
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
      // Try to persist token; ignore storage errors so auth flow can continue
      safeStorageSetToken(data.token, credentials.remember);
    }

    // Fetch user details
    const userData = await fetchUser(data.token);
    if (!userData) {
      throw new Error('Failed to load user profile');
    }
    
    // Automatically connect agent to Socket.IO if they have agent role
    if (userData.roles && userData.roles.includes('agent') && typeof window !== 'undefined') {
      try {
        const { io } = await import('socket.io-client');
        const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE || 'http://localhost:4000';
        const socket = io(SOCKET_URL, {
          withCredentials: true,
          transports: ['websocket', 'polling']
        });
        
        socket.on('connect', () => {
          console.log('🔌 Agent auto-connected to Socket.IO for online status');
          // Authenticate as agent using userId
          socket.emit('agent_auth', {
            token: data.token,
            agentId: userData.userId
          });
        });
        
        socket.on('agent_connected', (authData: any) => {
          console.log('✅ Agent authenticated successfully after login:', authData);
        });
        
        socket.on('auth_error', (error: any) => {
          console.error('❌ Agent authentication failed after login:', error);
        });
        
        socket.on('disconnect', () => {
          console.log('🔌 Agent Socket disconnected after login');
        });
        
        // If socket is already connected, authenticate immediately
        if (socket.connected) {
          console.log('🔌 Socket already connected, authenticating immediately after login');
          socket.emit('agent_auth', {
            token: data.token,
            agentId: userData.userId
          });
        }
        
        // Store socket reference (will be cleaned up on logout)
        (window as any).__agentSocket = socket;
      } catch (err) {
        console.warn('Failed to auto-connect agent to Socket.IO:', err);
      }
    }
  };

  const signup = async (signupData: { name: string; email: string; role?: string }) => {
    // Include role if provided (any user can now select their role)
    const payload: any = {
      name: signupData.name,
      email: signupData.email,
      role: signupData.role || 'agent' // Always include role, default to agent
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
    // Disconnect agent socket if it exists
    if (typeof window !== 'undefined' && (window as any).__agentSocket) {
      try {
        (window as any).__agentSocket.disconnect();
        delete (window as any).__agentSocket;
        console.log('🔌 Agent socket disconnected on logout');
      } catch (err) {
        console.warn('Error disconnecting agent socket:', err);
      }
    }
    
    // Clear token from memory
    setToken(null);
    setUser(null);
    safeStorageClearToken();

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
    return user.roles.includes(role);
  };

  const hasAnyRole = (roles: string[]): boolean => {
    if (!user) return false;
    return roles.some(role => hasRole(role));
  };

  const isAdmin = (): boolean => {
    return hasRole('admin');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      hasRole, 
      hasAnyRole, 
      isAdmin,
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
  const [showPermissionDenied, setShowPermissionDenied] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        setShouldRedirect(true);
      } else if (requiredRole) {
        const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
        if (!hasAnyRole(roles)) {
          // Show permission denied page instead of redirecting
          setShowPermissionDenied(true);
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

  if (showPermissionDenied) {
    return <PermissionDeniedPage />;
  }

  return <>{children}</>;
}
