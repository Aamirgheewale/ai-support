import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import RoleDropdown, { ROLE_OPTIONS } from '../components/common/RoleDropdown'
import Toast from '../components/common/Toast'
import UserProfileModal from '../components/common/UserProfileModal'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'dev-secret-change-me'
const DEV_ALLOW_SIGNUP_ROLE = import.meta.env.VITE_DEV_ALLOW_SIGNUP_ROLE === 'true'

export default function AuthPage() {
  const navigate = useNavigate()
  const { signin, signup, isSuperAdmin, user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<'signup' | 'signin'>('signin')
  
  // Sign Up state
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupRole, setSignupRole] = useState('viewer')
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({})
  const [signupLoading, setSignupLoading] = useState(false)
  
  // Sign In state
  const [signinEmail, setSigninEmail] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [signinErrors, setSigninErrors] = useState<Record<string, string>>({})
  const [signinLoading, setSigninLoading] = useState(false)
  
  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  
  // Always show role dropdown for new users to choose their role
  const showRoleDropdown = true
  
  // Redirect if already authenticated (but only after loading is complete)
  // Don't redirect if user is the dev-admin fallback and we're intentionally on auth page
  useEffect(() => {
    // Wait for loading to complete
    if (loading) {
      return
    }
    
    // Only redirect if user exists AND user is not the default dev-admin (which gets auto-created)
    // AND user has a real token (not just the fallback)
    if (user && user.userId !== 'dev-admin' && user.email !== 'dev@admin.local') {
      // Check if we have a real auth token (not just dev fallback)
      const hasToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
      if (hasToken) {
        navigate('/sessions')
      }
    }
  }, [user, loading, navigate])
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Tab switching: Ctrl/Cmd + 1 for Sign Up, Ctrl/Cmd + 2 for Sign In
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault()
        setActiveTab('signup')
      } else if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault()
        setActiveTab('signin')
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])
  
  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }
  
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setSignupErrors({})
    
    // Validation
    const errors: Record<string, string> = {}
    if (!signupName.trim()) {
      errors.name = 'Name is required'
    }
    if (!signupEmail.trim()) {
      errors.email = 'Email is required'
    } else if (!validateEmail(signupEmail)) {
      errors.email = 'Invalid email format'
    }
    
    if (Object.keys(errors).length > 0) {
      setSignupErrors(errors)
      return
    }
    
    setSignupLoading(true)
    try {
      const signupData: any = {
        name: signupName.trim(),
        email: signupEmail.trim(),
        role: signupRole || 'viewer' // Always include role selection, default to viewer if empty
      }
      
      console.log('📤 Signup data being sent:', signupData)
      console.log('📤 Selected role:', signupRole)
      
      await signup(signupData)
      
      setToast({ message: 'Account created successfully! Please sign in.', type: 'success' })
      setSignupName('')
      setSignupEmail('')
      setSignupRole('viewer')
      
      // Switch to sign in tab after 1 second
      setTimeout(() => {
        setActiveTab('signin')
        setSigninEmail(signupEmail.trim())
      }, 1000)
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to create account', type: 'error' })
    } finally {
      setSignupLoading(false)
    }
  }
  
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setSigninErrors({})
    
    // Validation
    const errors: Record<string, string> = {}
    if (!signinEmail.trim()) {
      errors.email = 'Email is required'
    } else if (!validateEmail(signinEmail)) {
      errors.email = 'Invalid email format'
    }
    
    if (Object.keys(errors).length > 0) {
      setSigninErrors(errors)
      return
    }
    
    setSigninLoading(true)
    try {
      await signin({
        email: signinEmail.trim(),
        remember: rememberMe
      })
      
      setToast({ message: 'Signed in successfully!', type: 'success' })
      // Open profile modal automatically after login
      setShowProfileModal(true)
      // Navigate after a short delay to allow modal to show
      setTimeout(() => {
        navigate('/sessions')
      }, 2000)
    } catch (err: any) {
      setToast({ message: err?.message || 'User not found', type: 'error' })
    } finally {
      setSigninLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <UserProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
      
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab('signup')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'signup'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              aria-selected={activeTab === 'signup'}
              role="tab"
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('signin')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'signin'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              aria-selected={activeTab === 'signin'}
              role="tab"
            >
              Sign In
            </button>
          </div>
          
          {/* Tab Content */}
          <div className="p-8">
            {/* Sign Up Tab */}
            {activeTab === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-5">
                <div>
                  <label htmlFor="signup-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className={`w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      signupErrors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="John Doe"
                    required
                  />
                  {signupErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{signupErrors.name}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className={`w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      signupErrors.email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="user@example.com"
                    required
                  />
                  {signupErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{signupErrors.email}</p>
                  )}
                </div>
                
                {showRoleDropdown && (
                  <RoleDropdown
                    value={signupRole}
                    onChange={setSignupRole}
                    showLabel={true}
                  />
                )}
                
                <button
                  type="submit"
                  disabled={signupLoading}
                  className="w-full bg-indigo-600 text-white rounded-lg px-4 py-3 font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {signupLoading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            )}
            
            {/* Sign In Tab */}
            {activeTab === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-5">
                <div>
                  <label htmlFor="signin-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="signin-email"
                    type="email"
                    value={signinEmail}
                    onChange={(e) => setSigninEmail(e.target.value)}
                    className={`w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      signinErrors.email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="user@example.com"
                    required
                  />
                  {signinErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{signinErrors.email}</p>
                  )}
                </div>
                
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    Remember me
                  </label>
                </div>
                
                <button
                  type="submit"
                  disabled={signinLoading}
                  className="w-full bg-indigo-600 text-white rounded-lg px-4 py-3 font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {signinLoading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>
            )}
            
            {/* Social/SSO Placeholders */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-center text-sm text-gray-500 mb-4">Or continue with</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Google
                </button>
                <button
                  type="button"
                  disabled
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  GitHub
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

