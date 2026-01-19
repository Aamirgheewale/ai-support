import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
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

// Sound/notification preferences stored per-user in Appwrite
export interface UserPrefs {
  masterEnabled?: boolean;
  desktopNotifications?: boolean;
  newSessionRingVolume?: number;
  repeatRing?: number;
  newMessagePopVolume?: number;
  notificationPopVolume?: number;
  [key: string]: any; // Allow additional prefs
}

export const DEFAULT_USER_PREFS: UserPrefs = {
  masterEnabled: true,
  desktopNotifications: true,
  newSessionRingVolume: 70,
  repeatRing: 1,
  newMessagePopVolume: 70,
  notificationPopVolume: 70
};

interface User {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  status?: string;        // "online" | "offline"
  accountStatus?: string; // "active" | "pending" | "rejected"
  permissions?: string[];
  createdAt?: string;
  lastSeen?: string;
  userMeta?: Record<string, any>;
  prefs?: UserPrefs;
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
  updateUserStatus: (status: 'online' | 'away') => Promise<boolean>;
  updateUserSettings: (newSettings: Partial<UserPrefs>) => Promise<boolean>;
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

        // Fetch user preferences separately
        try {
          const prefsRes = await fetch(`${API_BASE}/me/prefs`, {
            headers: {
              'Authorization': `Bearer ${tokenToUse}`
            },
            credentials: 'include'
          });
          if (prefsRes.ok) {
            const prefsData = await prefsRes.json();
            userData.prefs = { ...DEFAULT_USER_PREFS, ...prefsData.prefs };
          } else {
            userData.prefs = DEFAULT_USER_PREFS;
          }
        } catch {
          userData.prefs = DEFAULT_USER_PREFS;
        }

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

        // Auto-connect agent/admin to Socket.IO if they have agent or admin role and are already logged in
        // Both agents and admins should be marked as online in the database
        const hasAgentRole = userData?.roles && userData.roles.includes('agent');
        const hasAdminRole = userData?.roles && userData.roles.includes('admin');
        const hasSuperAdminRole = userData?.roles && userData.roles.includes('super_admin');

        if (userData && (hasAgentRole || hasAdminRole || hasSuperAdminRole) && typeof window !== 'undefined') {
          try {
            const { io } = await import('socket.io-client');
            const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE || 'http://localhost:4000';
            const socket = io(SOCKET_URL, {
              withCredentials: true,
              transports: ['websocket', 'polling'],
              reconnectionDelay: 500,
              reconnectionDelayMax: 1000
            });

            // Track if we've already authenticated to prevent duplicate emissions
            let hasAuthenticated = false;

            const authenticateAgent = () => {
              if (hasAuthenticated) {
                console.log('🔌 Agent/Admin already authenticated, skipping duplicate auth');
                return;
              }
              hasAuthenticated = true;
              console.log('🔌 Agent/Admin auto-connected to Socket.IO for online status (on page load)');
              socket.emit('agent_auth', {
                token: storedToken,
                agentId: userData.userId
              });
            };

            socket.on('connect', authenticateAgent);

            socket.on('agent_connected', (data: any) => {
              console.log('✅ Agent/Admin authenticated successfully:', data);
            });

            socket.on('auth_error', (error: any) => {
              console.error('❌ Agent/Admin authentication failed:', error);
            });

            socket.on('disconnect', () => {
              console.log('🔌 Agent/Admin Socket disconnected');
              // Reset flag so we can re-authenticate on reconnect
              hasAuthenticated = false;
            });

            // If socket is already connected, authenticate immediately
            if (socket.connected) {
              authenticateAgent();
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

    // Automatically connect agent/admin to Socket.IO if they have agent or admin role
    // Both agents and admins should be marked as online in the database
    const hasAgentRole = userData.roles && userData.roles.includes('agent');
    const hasAdminRole = userData.roles && userData.roles.includes('admin');
    const hasSuperAdminRole = userData.roles && userData.roles.includes('super_admin');

    if ((hasAgentRole || hasAdminRole || hasSuperAdminRole) && typeof window !== 'undefined') {
      try {
        const { io } = await import('socket.io-client');
        const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE || 'http://localhost:4000';
        const socket = io(SOCKET_URL, {
          withCredentials: true,
          transports: ['websocket', 'polling'],
          reconnectionDelay: 500,
          reconnectionDelayMax: 1000
        });

        // Track if we've already authenticated to prevent duplicate emissions
        let hasAuthenticated = false;

        const authenticateAgent = () => {
          if (hasAuthenticated) {
            console.log('🔌 Agent/Admin already authenticated, skipping duplicate auth');
            return;
          }
          hasAuthenticated = true;
          console.log('🔌 Agent/Admin auto-connected to Socket.IO for online status');
          socket.emit('agent_auth', {
            token: data.token,
            agentId: userData.userId
          });
        };

        socket.on('connect', authenticateAgent);

        socket.on('agent_connected', (authData: any) => {
          console.log('✅ Agent/Admin authenticated successfully after login:', authData);
        });

        socket.on('auth_error', (error: any) => {
          console.error('❌ Agent/Admin authentication failed after login:', error);
        });

        socket.on('disconnect', () => {
          console.log('🔌 Agent/Admin Socket disconnected after login');
          // Reset flag so we can re-authenticate on reconnect
          hasAuthenticated = false;
        });

        // If socket is already connected, authenticate immediately
        if (socket.connected) {
          authenticateAgent();
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

  const updateUserStatus = async (status: 'online' | 'away'): Promise<boolean> => {
    const tokenToUse = token || safeStorageGetToken();
    if (!tokenToUse || !user) {
      console.warn('Cannot update status: no token or user');
      return false;
    }

    try {
      const res = await fetch(`${API_BASE}/me/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`
        },
        credentials: 'include',
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        console.log(`✅ User status updated to: ${status}`);
        return true;
      } else {
        const error = await res.json().catch(() => ({ error: 'Failed to update status' }));
        console.error('Failed to update status:', error);
        return false;
      }
    } catch (err) {
      console.error('Error updating user status:', err);
      return false;
    }
  };

  const updateUserSettings = async (newSettings: Partial<UserPrefs>): Promise<boolean> => {
    const tokenToUse = token || safeStorageGetToken();
    if (!tokenToUse || !user) {
      console.warn('Cannot update settings: no token or user');
      return false;
    }

    // Optimistic update - merge new settings with existing prefs
    const mergedPrefs = { ...DEFAULT_USER_PREFS, ...user.prefs, ...newSettings };
    setUser(prev => prev ? { ...prev, prefs: mergedPrefs } : null);

    // Dispatch event for other components (like useSound) to pick up immediately
    window.dispatchEvent(new CustomEvent('user-prefs-updated', { detail: mergedPrefs }));

    try {
      const res = await fetch(`${API_BASE}/me/prefs`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`
        },
        credentials: 'include',
        body: JSON.stringify(newSettings)
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`✅ User settings updated:`, data.prefs);
        // Update with server response (in case of any transformations)
        setUser(prev => prev ? { ...prev, prefs: { ...DEFAULT_USER_PREFS, ...data.prefs } } : null);
        return true;
      } else {
        const error = await res.json().catch(() => ({ error: 'Failed to update settings' }));
        console.error('Failed to update settings:', error);
        // Revert optimistic update on failure
        await fetchUser(tokenToUse);
        return false;
      }
    } catch (err) {
      console.error('Error updating user settings:', err);
      // Revert optimistic update on failure
      await fetchUser(tokenToUse);
      return false;
    }
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
      refreshMe,
      updateUserStatus,
      updateUserSettings
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
  requiredPermission?: string;
}

export function ProtectedRoute({ children, requiredRole, requiredPermission }: ProtectedRouteProps) {
  const { user, loading, hasRole, hasAnyRole, isAdmin } = useAuth();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [shouldRedirectToWaiting, setShouldRedirectToWaiting] = useState(false);
  const [showPermissionDenied, setShowPermissionDenied] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        setShouldRedirect(true);
      } else {
        let accessGranted = true;

        // Role Check
        if (requiredRole) {
          const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
          if (!hasAnyRole(roles)) {
            accessGranted = false;
          }
        }

        // Permission Check (skip for admins)
        if (requiredPermission && !isAdmin()) {
          const userPerms = user.permissions || [];
          if (!userPerms.includes(requiredPermission)) {
            accessGranted = false;
          }
        }

        if (!accessGranted) {
          // If user has NO permissions and is not admin, likely they need to go to waiting page
          if (!isAdmin() && (!user.permissions || user.permissions.length === 0)) {
            setShouldRedirectToWaiting(true);
          } else {
            setShowPermissionDenied(true);
          }
        }
      }
    }
  }, [user, loading, requiredRole, requiredPermission, hasRole, hasAnyRole, isAdmin]);

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

  if (shouldRedirectToWaiting) {
    return <Navigate to="/waiting-for-access" replace />;
  }

  if (showPermissionDenied) {
    return <PermissionDeniedPage />;
  }

  return <>{children}</>;
}
