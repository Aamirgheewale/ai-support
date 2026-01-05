import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth, ProtectedRoute } from './hooks/useAuth'
import { NotificationProvider, useNotifications } from './context/NotificationContext'
import { SoundProvider } from './context/SoundContext'
import SessionsList from './pages/SessionsList'
import ConversationView from './pages/ConversationView'
import AnalyticsPage from './pages/AnalyticsPage'
import UsersPage from './pages/UsersPage'
import AccuracyPage from './pages/AccuracyPage'
import EncryptionPage from './pages/EncryptionPage'
import LiveVisitors from './pages/LiveVisitors'
import AgentsOnline from './pages/AgentsOnline'
import SignupPage from './pages/SignupPage'
import AuthPage from './pages/AuthPage'
import PermissionDeniedPage from './pages/PermissionDeniedPage'
import PendingQueries from './pages/PendingQueries'
import NotificationsPage from './pages/NotificationsPage'
import AudioNotifications from './components/common/AudioNotifications'
import SidebarHeader from './components/sidebar/SidebarHeader'
import StopRingButton from './components/sidebar/StopRingButton'
import { useState, useEffect, useRef } from 'react'

function Navigation() {
  const { hasRole, user, isAdmin, loading, signout } = useAuth()
  const { unreadCount } = useNotifications()
  const location = useLocation()
  const navigate = useNavigate()
  const [isPendingQueriesOpen, setIsPendingQueriesOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const prevPathnameRef = useRef<string>('')

  const handleLogout = async () => {
    try {
      await signout()
      navigate('/auth')
    } catch (err) {
      console.error('Logout error:', err)
      // Still redirect even if logout fails
      navigate('/auth')
    }
  }

  // Check if pending queries sub-menu should be open
  const isPendingQueriesActive = location.pathname === '/pending-queries'

  // Keyboard shortcuts: g u for users
  // MUST be called before any early returns (Rules of Hooks)
  useEffect(() => {
    // Only set up keyboard shortcuts if we're not on auth pages and user exists
    if (location.pathname === '/signup' || location.pathname === '/auth' || !user) {
      return
    }

    let keySequence = ''
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'g') {
        keySequence = 'g'
        setTimeout(() => { keySequence = '' }, 1000)
      } else if (keySequence === 'g' && e.key === 'u') {
        e.preventDefault()
        if (isAdmin()) {
          navigate('/users')
        } else {
          navigate('/users?denied=true')
        }
        keySequence = ''
      } else {
        keySequence = ''
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [navigate, isAdmin, location.pathname, user])

  // Auto-expand pending queries menu only when navigating TO that route (not when already on it)
  // MUST be called before any early returns (Rules of Hooks)
  useEffect(() => {
    // Only auto-expand if we just navigated TO pending-queries (not if we were already on it)
    if (isPendingQueriesActive && prevPathnameRef.current !== '/pending-queries') {
      setIsPendingQueriesOpen(true)
    }
    // Update the ref to track the current pathname
    prevPathnameRef.current = location.pathname
  }, [location.pathname, isPendingQueriesActive])
  // Fetch pending query count from tickets API
  useEffect(() => {
    if (!user || !(hasRole('admin') || hasRole('agent'))) {
      return;
    }

    const fetchPendingCount = async () => {
      try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        if (!token) return;

        const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
        const response = await fetch(`${API_BASE}/api/tickets`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const pendingTickets = (data.tickets || []).filter((t: any) => t.status === 'pending');
          setPendingCount(pendingTickets.length);
        }
      } catch (error) {
        console.error('Failed to fetch pending count:', error);
      }
    };

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Don't show navigation on auth/signup pages
  if (location.pathname === '/signup' || location.pathname === '/auth') {
    return null
  }

  // Don't show navigation if still loading or user is not authenticated
  if (loading || !user) {
    return null
  }

  // Helper function to check if a route is active
  const isActive = (path: string) => {
    if (path === '/sessions') {
      return location.pathname === '/sessions' || location.pathname.startsWith('/sessions/')
    }
    return location.pathname === path
  }

  return (
    <>
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col z-50 hidden lg:flex">
        {/* New Sidebar Header with User Profile & Notifications */}
        <SidebarHeader />

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          <Link
            to="/sessions"
            className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive('/sessions')
              ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
          >
            <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Sessions
          </Link>

          <Link
            to="/live"
            className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive('/live')
              ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
          >
            <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Live View
          </Link>

          {/* Users link - visible to admin only (hidden for agent) */}
          {hasRole('admin') && (
            <Link
              to="/users"
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive('/users')
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Users
            </Link>
          )}

          {/* Agents Online link - visible to admin/agent */}
          {(hasRole('admin') || hasRole('agent')) && (
            <Link
              to="/agents-online"
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive('/agents-online')
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Agents Online
            </Link>
          )}

          {/* Pending Queries accordion - visible to admin/agent */}
          {(hasRole('admin') || hasRole('agent')) && (
            <div>
              <button
                onClick={() => {
                  if (isPendingQueriesOpen) {
                    // If already open, just collapse it
                    setIsPendingQueriesOpen(false);
                  } else {
                    // If closed, open it and navigate to pending
                    setIsPendingQueriesOpen(true);
                    navigate('/pending-queries?status=pending');
                  }
                }}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isPendingQueriesActive
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Pending Queries</span>
                  {/* Pending count badge */}
                  {pendingCount > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs font-semibold rounded-full px-2 py-0.5 min-w-[20px] text-center">
                      {pendingCount}
                    </span>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${isPendingQueriesOpen ? 'transform rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {isPendingQueriesOpen && (
                <div className="ml-4 mt-1 space-y-1">
                  <Link
                    to="/pending-queries?status=pending"
                    className={`flex items-center px-4 py-2 text-xs font-medium rounded-lg transition-colors ${location.pathname === '/pending-queries' && (location.search === '' || location.search === '?status=pending')
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    <span className="ml-2">Pending</span>
                  </Link>
                  <Link
                    to="/pending-queries?status=resolved"
                    className={`flex items-center px-4 py-2 text-xs font-medium rounded-lg transition-colors ${location.pathname === '/pending-queries' && location.search === '?status=resolved'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    <span className="ml-2">Resolved</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Notifications link - visible to admin/agent */}
          {(hasRole('admin') || hasRole('agent')) && (
            <Link
              to="/notifications"
              className={`flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive('/notifications')
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span>Notifications</span>
              </div>
              {/* Notification Badge - shows count when > 0 */}
              {unreadCount > 0 && (
                <span className="ml-auto bg-blue-500 text-white text-xs font-semibold rounded-full px-2 py-0.5 min-w-[20px] text-center">
                  {unreadCount}
                </span>
              )}
            </Link>
          )}

          {/* Analytics link - visible to admin */}
          {hasRole('admin') && (
            <Link
              to="/analytics"
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive('/analytics')
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analytics
            </Link>
          )}

          {/* Accuracy link - visible to admin */}
          {hasRole('admin') && (
            <Link
              to="/accuracy"
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive('/accuracy')
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Accuracy
            </Link>
          )}

          {/* Encryption link - visible to admin */}
          {hasRole('admin') && (
            <Link
              to="/encryption"
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive('/encryption')
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Encryption
            </Link>
          )}
        </nav>

        {/* Logout Button - Fixed at bottom */}
        <div className="border-t border-gray-200 p-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Navigation - Hamburger Menu (Hidden on desktop) */}
      <nav className="lg:hidden bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900">Support</span>
          {/* Mobile uses simplified header - full profile in sidebar on desktop */}
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Link to="/notifications" className="relative p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-blue-500 rounded-full">
                  {unreadCount}
                </span>
              </Link>
            )}
          </div>
        </div>
        {/* Mobile Navigation Links */}
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          <Link
            to="/sessions"
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${isActive('/sessions') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Sessions
          </Link>
          <Link
            to="/live"
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${isActive('/live') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Live
          </Link>
          {hasRole('admin') && (
            <Link
              to="/users"
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${isActive('/users') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Users
            </Link>
          )}
          {(hasRole('admin') || hasRole('agent')) && (
            <Link
              to="/agents-online"
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${isActive('/agents-online') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Agents
            </Link>
          )}
          {(hasRole('admin') || hasRole('agent')) && (
            <>
              <Link
                to="/pending-queries?status=pending"
                className={`px-3 py-1.5 text-xs font-medium rounded-md ${location.pathname === '/pending-queries' && (location.search === '' || location.search === '?status=pending')
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Pending
              </Link>
              <Link
                to="/pending-queries?status=resolved"
                className={`px-3 py-1.5 text-xs font-medium rounded-md ${location.pathname === '/pending-queries' && location.search === '?status=resolved'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Resolved
              </Link>
            </>
          )}
          {hasRole('admin') && (
            <Link
              to="/analytics"
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${isActive('/analytics') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Analytics
            </Link>
          )}
          {hasRole('admin') && (
            <Link
              to="/accuracy"
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${isActive('/accuracy') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Accuracy
            </Link>
          )}
          {hasRole('admin') && (
            <Link
              to="/encryption"
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${isActive('/encryption') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Encryption
            </Link>
          )}
        </div>
      </nav>
    </>
  )
}

// Users route wrapper that checks permissions
function UsersRoute() {
  const { isAdmin } = useAuth()
  const location = useLocation()

  // Check if access was denied via query param
  if (location.search.includes('denied=true') || !isAdmin()) {
    return <PermissionDeniedPage />
  }

  return <UsersPage />
}

function App() {
  return (
    <AuthProvider>
      <SoundProvider>
        <NotificationProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-gray-50">
              <Navigation />
              <AudioNotifications />
              <StopRingButton />

              {/* Main Content Area */}
              <main className="lg:ml-64 min-h-screen">
                <Routes>
                  <Route path="/" element={<Navigate to="/auth" replace />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/sessions" element={<ProtectedRoute><SessionsList /></ProtectedRoute>} />
                  <Route path="/sessions/:sessionId" element={<ProtectedRoute><ConversationView /></ProtectedRoute>} />
                  <Route path="/live" element={<ProtectedRoute><LiveVisitors /></ProtectedRoute>} />
                  <Route path="/pending-queries" element={<ProtectedRoute requiredRole={['admin', 'agent']}><PendingQueries /></ProtectedRoute>} />
                  <Route path="/analytics" element={<ProtectedRoute requiredRole="admin"><AnalyticsPage /></ProtectedRoute>} />
                  <Route path="/accuracy" element={<ProtectedRoute requiredRole="admin"><AccuracyPage /></ProtectedRoute>} />
                  <Route path="/users" element={<ProtectedRoute><UsersRoute /></ProtectedRoute>} />
                  <Route path="/agents-online" element={<ProtectedRoute requiredRole={['admin', 'agent']}><AgentsOnline /></ProtectedRoute>} />
                  <Route path="/signup" element={<ProtectedRoute requiredRole="admin"><SignupPage /></ProtectedRoute>} />
                  <Route path="/encryption" element={<ProtectedRoute requiredRole="admin"><EncryptionPage /></ProtectedRoute>} />
                  <Route path="/notifications" element={<ProtectedRoute requiredRole={['admin', 'agent']}><NotificationsPage /></ProtectedRoute>} />
                </Routes>
              </main>
            </div>
          </BrowserRouter>
        </NotificationProvider>
      </SoundProvider>
    </AuthProvider>
  )
}

export default App

