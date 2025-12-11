import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth, ProtectedRoute } from './hooks/useAuth'
import SessionsList from './pages/SessionsList'
import ConversationView from './pages/ConversationView'
import AnalyticsPage from './pages/AnalyticsPage'
import UsersPage from './pages/UsersPage'
import AccuracyPage from './pages/AccuracyPage'
import EncryptionPage from './pages/EncryptionPage'
import LiveVisitors from './pages/LiveVisitors'
import SignupPage from './pages/SignupPage'
import AuthPage from './pages/AuthPage'
import PermissionDeniedPage from './pages/PermissionDeniedPage'
import UserProfileModal from './components/common/UserProfileModal'
import { useState, useEffect } from 'react'

function Navigation() {
  const { hasRole, user, isSuperAdmin, loading } = useAuth()
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
        if (isSuperAdmin()) {
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
  }, [navigate, isSuperAdmin, location.pathname, user])

  // Don't show navigation on auth/signup pages
  if (location.pathname === '/signup' || location.pathname === '/auth') {
    return null
  }

  // Don't show navigation if still loading or user is not authenticated
  if (loading || !user) {
    return null
  }
  
  return (
    <>
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold text-gray-900">AI Support Admin</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  to="/sessions"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Sessions
                </Link>
                <Link
                  to="/live"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Live View
                </Link>
                <Link
                  to="/analytics"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Analytics
                </Link>
                {/* Accuracy link - only visible to admin/super_admin */}
                {(hasRole('admin') || hasRole('super_admin')) && (
                  <Link
                    to="/accuracy"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Accuracy
                  </Link>
                )}
                {/* Users link - always visible but gated by route */}
                <Link
                  to="/users"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Users
                </Link>
                {/* Encryption link - only visible to super_admin */}
                {hasRole('super_admin') && (
                  <Link
                    to="/encryption"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Encryption
                  </Link>
                )}
              </div>
            </div>
            {/* User name on the right */}
            <div className="flex items-center">
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none"
              >
                <span className="mr-2">{user.name || user.email || 'User'}</span>
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>
      <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
    </>
  )
}

// Users route wrapper that checks permissions
function UsersRoute() {
  const { isSuperAdmin } = useAuth()
  const location = useLocation()
  
  // Check if access was denied via query param
  if (location.search.includes('denied=true') || !isSuperAdmin()) {
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

          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/sessions" element={<ProtectedRoute><SessionsList /></ProtectedRoute>} />
            <Route path="/sessions/:sessionId" element={<ProtectedRoute><ConversationView /></ProtectedRoute>} />
            <Route path="/live" element={<ProtectedRoute><LiveVisitors /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/accuracy" element={<ProtectedRoute requiredRole={['admin', 'super_admin']}><AccuracyPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UsersRoute /></ProtectedRoute>} />
            <Route path="/signup" element={<ProtectedRoute requiredRole="super_admin"><SignupPage /></ProtectedRoute>} />
            <Route path="/encryption" element={<ProtectedRoute requiredRole="super_admin"><EncryptionPage /></ProtectedRoute>} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

