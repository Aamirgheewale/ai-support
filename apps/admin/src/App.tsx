import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth, ProtectedRoute } from './hooks/useAuth'
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
import UserProfileModal from './components/common/UserProfileModal'
import AudioNotifications from './components/common/AudioNotifications'
import AudioControls from './components/common/AudioControls'
import { useState, useEffect } from 'react'

function Navigation() {
  const { hasRole, user, isAdmin, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  // Keyboard shortcuts: g p for profile, g u for users
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
      } else if (keySequence === 'g' && e.key === 'p') {
        e.preventDefault()
        setIsProfileModalOpen(true)
        keySequence = ''
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
        {/* Brand Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <span className="text-xl font-bold text-gray-900">Customer Support</span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <Link
            to="/sessions"
            className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              isActive('/sessions')
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
            className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              isActive('/live')
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
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isActive('/users')
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
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isActive('/agents-online')
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

          {/* Analytics link - visible to admin */}
          {hasRole('admin') && (
            <Link
              to="/analytics"
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isActive('/analytics')
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
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isActive('/accuracy')
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
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isActive('/encryption')
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

        {/* Audio Controls - Visible to admin/agent */}
        {(hasRole('admin') || hasRole('agent')) && (
          <AudioControls />
        )}

        {/* User Profile Section - Pinned to Bottom */}
        <div className="px-4 py-4 border-t border-gray-200">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors focus:outline-none"
          >
            <svg className="h-5 w-5 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="flex-1 text-left truncate">{user.name || user.email || 'User'}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Navigation - Hamburger Menu (Hidden on desktop) */}
      <nav className="lg:hidden bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900">Customer Support</span>
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none"
          >
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
        </div>
        {/* Mobile Navigation Links */}
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          <Link
            to="/sessions"
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              isActive('/sessions') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Sessions
          </Link>
          <Link
            to="/live"
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              isActive('/live') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Live
          </Link>
          {hasRole('admin') && (
            <Link
              to="/users"
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                isActive('/users') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Users
            </Link>
          )}
          {(hasRole('admin') || hasRole('agent')) && (
            <Link
              to="/agents-online"
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                isActive('/agents-online') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Agents
            </Link>
          )}
          {hasRole('admin') && (
            <Link
              to="/analytics"
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                isActive('/analytics') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Analytics
            </Link>
          )}
          {hasRole('admin') && (
            <Link
              to="/accuracy"
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                isActive('/accuracy') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Accuracy
            </Link>
          )}
          {hasRole('admin') && (
            <Link
              to="/encryption"
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                isActive('/encryption') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Encryption
            </Link>
          )}
        </div>
      </nav>

      <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
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
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <AudioNotifications />

          {/* Main Content Area */}
          <main className="lg:ml-64 min-h-screen">
            <Routes>
              <Route path="/" element={<Navigate to="/auth" replace />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/sessions" element={<ProtectedRoute><SessionsList /></ProtectedRoute>} />
              <Route path="/sessions/:sessionId" element={<ProtectedRoute><ConversationView /></ProtectedRoute>} />
              <Route path="/live" element={<ProtectedRoute><LiveVisitors /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute requiredRole="admin"><AnalyticsPage /></ProtectedRoute>} />
              <Route path="/accuracy" element={<ProtectedRoute requiredRole="admin"><AccuracyPage /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><UsersRoute /></ProtectedRoute>} />
              <Route path="/agents-online" element={<ProtectedRoute requiredRole={['admin', 'agent']}><AgentsOnline /></ProtectedRoute>} />
              <Route path="/signup" element={<ProtectedRoute requiredRole="admin"><SignupPage /></ProtectedRoute>} />
              <Route path="/encryption" element={<ProtectedRoute requiredRole="admin"><EncryptionPage /></ProtectedRoute>} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

