import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth, ProtectedRoute } from './hooks/useAuth'
import { NotificationProvider, useNotifications } from './context/NotificationContext'
import { SoundProvider } from './context/SoundContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { Shirt, Sun, Moon, ChevronRight, ChevronLeft, MessageSquare, Video, Users, User, FileText, Bell, BarChart3, CheckCircle, Lock, Check, LogOut, LayoutDashboard, Inbox } from 'lucide-react'
import SessionsList from './pages/SessionsList'
import ConversationView from './pages/ConversationView'
import Dashboard from './pages/Dashboard'
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
import WaitingForAccess from './pages/WaitingForAccess'
import AgentInbox from './pages/AgentInbox'

import { useState, useEffect, useRef } from 'react'

interface NavigationProps {
  isSidebarCollapsed: boolean
  toggleSidebar: () => void
}

function Navigation({ isSidebarCollapsed, toggleSidebar }: NavigationProps) {
  const { hasRole, user, isAdmin, loading, signout } = useAuth()
  const { unreadCount } = useNotifications()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [isPendingQueriesOpen, setIsPendingQueriesOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [isThemePopoverOpen, setIsThemePopoverOpen] = useState(false)
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
    // const interval = setInterval(fetchPendingCount, 30000); // Polling Removed to prevent API quota leak
    // return () => clearInterval(interval);
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

  // Helper to check granular permissions
  const hasPermission = (perm: string) => {
    if (isAdmin()) return true;
    return user?.permissions?.includes(perm) || false;
  };

  return (
    <>
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-50 hidden lg:flex transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-20 overflow-visible' : 'w-64'} group`}>
        {/* Toggle Button - Centered vertically */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-lg transition-all duration-300 ease-in-out"
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          )}
        </button>

        {/* New Sidebar Header with User Profile & Notifications */}
        <SidebarHeader isCollapsed={isSidebarCollapsed} />

        {/* Navigation Links */}
        <nav
          className={`flex-1 w-full flex flex-col items-center scrollbar-hide ${isSidebarCollapsed ? 'py-4 gap-y-1 overflow-visible' : 'py-4 px-4 space-y-1 overflow-y-auto'}`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >



          {hasPermission('agent_inbox') && (
            <Link
              to="/agent/inbox"
              className={`${isSidebarCollapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full px-4 py-3 flex items-center justify-start'} text-sm font-medium rounded-lg transition-all duration-300 ease-in-out ${isActive('/agent/inbox')
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                } relative group/item`}
              title={isSidebarCollapsed ? 'Inbox' : ''}
            >
              <Inbox className="w-5 h-5" />
              {!isSidebarCollapsed && <span className="ml-3">Inbox</span>}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none z-[999]">
                  Inbox
                </span>
              )}
            </Link>
          )}

          {hasPermission('dashboard') && (
            <Link
              to="/dashboard"
              className={`${isSidebarCollapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full px-4 py-3 flex items-center justify-start'} text-sm font-medium rounded-lg transition-all duration-300 ease-in-out ${isActive('/dashboard')
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                } relative group/item`}
              title={isSidebarCollapsed ? 'Dashboard' : ''}
            >
              <LayoutDashboard className="w-5 h-5" />
              {!isSidebarCollapsed && <span className="ml-3">Dashboard</span>}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none z-[999]">
                  Dashboard
                </span>
              )}
            </Link>
          )}

          {hasPermission('sessions') && (
            <Link
              to="/sessions"
              className={`${isSidebarCollapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full px-4 py-3 flex items-center justify-start'} text-sm font-medium rounded-lg transition-all duration-300 ease-in-out ${isActive('/sessions')
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                } relative group/item`}
              title={isSidebarCollapsed ? 'Sessions' : ''}
            >
              <MessageSquare className="w-5 h-5" />
              {!isSidebarCollapsed && <span className="ml-3">Sessions</span>}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none z-[999]">
                  Sessions
                </span>
              )}
            </Link>
          )}

          {hasPermission('live') && (
            <Link
              to="/live"
              className={`${isSidebarCollapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full px-4 py-3 flex items-center justify-start'} text-sm font-medium rounded-lg transition-all duration-300 ease-in-out ${isActive('/live')
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                } relative group/item`}
              title={isSidebarCollapsed ? 'Live View' : ''}
            >
              <Video className="w-5 h-5" />
              {!isSidebarCollapsed && <span className="ml-3">Live View</span>}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none z-[999]">
                  Live View
                </span>
              )}
            </Link>
          )}



          {/* Users link - visible if has 'users' permission (previously admin only) */}
          {hasPermission('users') && (
            <Link
              to="/users"
              className={`${isSidebarCollapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full px-4 py-3 flex items-center justify-start'} text-sm font-medium rounded-lg transition-all duration-300 ease-in-out ${isActive('/users')
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                } relative group/item`}
              title={isSidebarCollapsed ? 'Users' : ''}
            >
              <Users className="w-5 h-5" />
              {!isSidebarCollapsed && <span className="ml-3">Users</span>}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none z-[999]">
                  Users
                </span>
              )}
            </Link>
          )}

          {/* Agents Online link - visible to admin/agent */}
          {hasPermission('agents_online') && (
            <Link
              to="/agents-online"
              className={`${isSidebarCollapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full px-4 py-3 flex items-center justify-start'} text-sm font-medium rounded-lg transition-all duration-300 ease-in-out ${isActive('/agents-online')
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                } relative group/item`}
              title={isSidebarCollapsed ? 'Agents Online' : ''}
            >
              <Users className="w-5 h-5" />
              {!isSidebarCollapsed && <span className="ml-3">Agents Online</span>}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none z-[999]">
                  Agents Online
                </span>
              )}
            </Link>
          )}

          {/* Pending Queries - permission 'sessions' or basic agent access */}
          {hasPermission('pending_queries') && (
            <div>
              <button
                onClick={() => {
                  if (isPendingQueriesOpen) {
                    setIsPendingQueriesOpen(false);
                  } else {
                    setIsPendingQueriesOpen(true);
                    navigate('/pending-queries?status=pending');
                  }
                }}
                className={`${isSidebarCollapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full px-4 py-3 flex items-center justify-between'} text-sm font-medium rounded-lg transition-all duration-300 ease-in-out ${isPendingQueriesActive
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                  } relative group/item`}
                title={isSidebarCollapsed ? (pendingCount > 0 ? `${pendingCount} Pending Queries` : 'Pending Queries') : undefined}
              >
                <FileText className="w-5 h-5" />
                {isSidebarCollapsed && pendingCount > 0 && (
                  <span className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md border-2 border-white min-w-[16px] h-4 px-1 text-[10px] font-bold leading-tight">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
                {!isSidebarCollapsed && (
                  <>
                    <span className="ml-3 flex items-center flex-1 min-w-0">
                      <span className="whitespace-nowrap">Pending Queries</span>
                      {pendingCount > 0 && (
                        <span className="ml-2 bg-red-500 text-white text-xs font-semibold rounded-full px-2 py-0.5 min-w-[20px] text-center flex-shrink-0">
                          {pendingCount}
                        </span>
                      )}
                    </span>
                    <ChevronRight
                      className={`w-4 h-4 transition-all duration-300 ease-in-out flex-shrink-0 ${isPendingQueriesOpen ? 'transform rotate-90' : ''}`}
                    />
                  </>
                )}
                {/* Tooltip when collapsed */}
                {isSidebarCollapsed && (
                  <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none z-[999]">
                    Pending Queries{pendingCount > 0 && ` (${pendingCount})`}
                  </span>
                )}
              </button>
              {isPendingQueriesOpen && !isSidebarCollapsed && (
                <div className="ml-4 mt-1 space-y-1">
                  <Link
                    to="/pending-queries?status=pending"
                    className={`flex items-center px-4 py-2 text-xs font-medium rounded-lg transition-colors ${location.pathname === '/pending-queries' && (location.search === '' || location.search === '?status=pending')
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                      }`}
                  >
                    <span className="ml-2">Pending</span>
                  </Link>
                  <Link
                    to="/pending-queries?status=resolved"
                    className={`flex items-center px-4 py-2 text-xs font-medium rounded-lg transition-colors ${location.pathname === '/pending-queries' && location.search === '?status=resolved'
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                      }`}
                  >
                    <span className="ml-2">Resolved</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Notifications link */}
          {hasPermission('notifications') && (
            <Link
              to="/notifications"
              className={`${isSidebarCollapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full px-4 py-3 flex items-center justify-between'} text-sm font-medium rounded-lg transition-all duration-300 ease-in-out ${isActive('/notifications')
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                } relative group/item`}
              title={isSidebarCollapsed ? (unreadCount > 0 ? `${unreadCount} Unread Notifications` : 'Notifications') : undefined}
            >
              <Bell className="w-5 h-5" />
              {isSidebarCollapsed && unreadCount > 0 && (
                <span className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-md border-2 border-white min-w-[16px] h-4 px-1 text-[10px] font-bold leading-tight">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              {!isSidebarCollapsed && (
                <>
                  <span className="ml-3">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="ml-auto bg-blue-500 text-white text-xs font-semibold rounded-full px-2 py-0.5 min-w-[20px] text-center">
                      {unreadCount}
                    </span>
                  )}
                </>
              )}
              {/* Tooltip when collapsed */}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none z-[999]">
                  Notifications{unreadCount > 0 && ` (${unreadCount})`}
                </span>
              )}
            </Link>
          )}

          {/* Analytics link */}
          {hasPermission('analytics') && (
            <Link
              to="/analytics"
              className={`${isSidebarCollapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full px-4 py-3 flex items-center justify-start'} text-sm font-medium rounded-lg transition-all duration-300 ease-in-out ${isActive('/analytics')
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                } relative group/item`}
              title={isSidebarCollapsed ? 'Analytics' : ''}
            >
              <BarChart3 className="w-5 h-5" />
              {!isSidebarCollapsed && <span className="ml-3">Analytics</span>}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none z-[999]">
                  Analytics
                </span>
              )}
            </Link>
          )}

          {/* Accuracy link */}
          {hasPermission('accuracy') && (
            <Link
              to="/accuracy"
              className={`${isSidebarCollapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full px-4 py-3 flex items-center justify-start'} text-sm font-medium rounded-lg transition-all duration-300 ease-in-out ${isActive('/accuracy')
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                } relative group/item`}
              title={isSidebarCollapsed ? 'Accuracy' : ''}
            >
              <CheckCircle className="w-5 h-5" />
              {!isSidebarCollapsed && <span className="ml-3">Accuracy</span>}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none z-[999]">
                  Accuracy
                </span>
              )}
            </Link>
          )}

          {/* Encryption link */}
          {hasPermission('encryption') && (
            <Link
              to="/encryption"
              className={`${isSidebarCollapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full px-4 py-3 flex items-center justify-start'} text-sm font-medium rounded-lg transition-all duration-300 ease-in-out ${isActive('/encryption')
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                } relative group/item`}
              title={isSidebarCollapsed ? 'Encryption' : ''}
            >
              <Lock className="w-5 h-5" />
              {!isSidebarCollapsed && <span className="ml-3">Encryption</span>}
              {isSidebarCollapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none z-[999]">
                  Encryption
                </span>
              )}
            </Link>
          )}
        </nav>

        {/* Theme Toggle - Only visible when collapsed */}
        {isSidebarCollapsed && (
          <div className="border-t border-gray-200 dark:border-gray-800 w-full flex justify-center py-4">
            <div className="relative group/item">
              <button
                onMouseEnter={() => setIsThemePopoverOpen(true)}
                onMouseLeave={() => setIsThemePopoverOpen(false)}
                className="w-10 h-10 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-all duration-300 ease-in-out"
              >
                <Shirt className="w-5 h-5" />
              </button>

              {/* Theme Popover - Shows on hover */}
              {isThemePopoverOpen && (
                <div
                  className="absolute left-full ml-2 top-0 w-40 bg-gray-900 dark:bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50 py-1"
                  onMouseEnter={() => setIsThemePopoverOpen(true)}
                  onMouseLeave={() => setIsThemePopoverOpen(false)}
                >
                  <button
                    onClick={() => {
                      setTheme('light')
                      setIsThemePopoverOpen(false)
                    }}
                    className={`w-full px-3 py-2 flex items-center gap-2 text-sm text-white dark:text-gray-300 hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors ${theme === 'light' ? 'bg-gray-800 dark:bg-gray-700' : ''
                      }`}
                  >
                    <Sun className={`w-4 h-4 ${theme === 'light' ? 'text-yellow-400' : 'text-gray-400'}`} />
                    <span>Light</span>
                    {theme === 'light' && (
                      <Check className="w-4 h-4 ml-auto text-yellow-400" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setTheme('dark')
                      setIsThemePopoverOpen(false)
                    }}
                    className={`w-full px-3 py-2 flex items-center gap-2 text-sm text-white dark:text-gray-300 hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors ${theme === 'dark' ? 'bg-gray-800 dark:bg-gray-700' : ''
                      }`}
                  >
                    <Moon className={`w-4 h-4 ${theme === 'dark' ? 'text-blue-400' : 'text-gray-400'}`} />
                    <span>Dark</span>
                    {theme === 'dark' && (
                      <Check className="w-4 h-4 ml-auto text-blue-400" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logout Button - Fixed at bottom */}
        <div className="border-t border-gray-200 dark:border-gray-800 w-full flex justify-center py-4">
          <button
            onClick={handleLogout}
            className={`${isSidebarCollapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full px-4 py-3 flex items-center justify-start'} text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white rounded-lg transition-all duration-300 ease-in-out relative group/item`}
            title={isSidebarCollapsed ? 'Logout' : ''}
          >
            <LogOut className="w-5 h-5" />
            {!isSidebarCollapsed && <span className="ml-3">Logout</span>}
            {/* Tooltip when collapsed */}
            {isSidebarCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none z-[999]">
                Logout
              </span>
            )}
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
                <Bell className="w-5 h-5 text-gray-500" />
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

function RootRedirect() {
  const { user, isAdmin } = useAuth()

  if (!user) return <Navigate to="/auth" replace />

  // Admins go to Dashboard by default
  if (isAdmin()) return <Navigate to="/dashboard" replace />

  // Agents go to first allowed route
  const p = user.permissions || []
  if (p.includes('agent_inbox')) return <Navigate to="/agent/inbox" replace />
  if (p.includes('dashboard')) return <Navigate to="/dashboard" replace />
  if (p.includes('sessions')) return <Navigate to="/sessions" replace />
  if (p.includes('live')) return <Navigate to="/live" replace />
  if (p.includes('users')) return <Navigate to="/users" replace />
  if (p.includes('agents_online')) return <Navigate to="/agents-online" replace />
  if (p.includes('pending_queries')) return <Navigate to="/pending-queries" replace />

  // If no permissions (and not admin), go to Waiting page
  return <Navigate to="/waiting-for-access" replace />
}

function App() {
  // Sidebar collapse state with localStorage persistence (lifted to App level)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved === 'true'
  })

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed
    setIsSidebarCollapsed(newState)
    localStorage.setItem('sidebarCollapsed', String(newState))
  }

  return (
    <AuthProvider>
      <ThemeProvider>
        <SoundProvider>
          <NotificationProvider>
            <BrowserRouter>
              <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                <Navigation isSidebarCollapsed={isSidebarCollapsed} toggleSidebar={toggleSidebar} />
                <AudioNotifications />
                <StopRingButton />

                {/* Main Content Area */}
                <main className={`min-h-screen transition-all duration-300 ease-in-out text-gray-900 dark:text-white ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
                  <Routes>
                    <Route path="/" element={<RootRedirect />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/waiting-for-access" element={<ProtectedRoute><WaitingForAccess /></ProtectedRoute>} />

                    <Route path="/dashboard" element={<ProtectedRoute requiredPermission="dashboard"><Dashboard /></ProtectedRoute>} />
                    <Route path="/sessions" element={<ProtectedRoute requiredPermission="sessions"><SessionsList /></ProtectedRoute>} />
                    <Route path="/sessions/:sessionId" element={<ProtectedRoute requiredPermission="sessions"><ConversationView /></ProtectedRoute>} />
                    <Route path="/live" element={<ProtectedRoute requiredPermission="live"><LiveVisitors /></ProtectedRoute>} />
                    <Route path="/agent/inbox" element={<ProtectedRoute requiredPermission="agent_inbox"><AgentInbox /></ProtectedRoute>} />
                    <Route path="/pending-queries" element={<ProtectedRoute requiredRole={['admin', 'agent']} requiredPermission="pending_queries"><PendingQueries /></ProtectedRoute>} />

                    <Route path="/analytics" element={<ProtectedRoute requiredPermission="analytics"><AnalyticsPage /></ProtectedRoute>} />
                    <Route path="/accuracy" element={<ProtectedRoute requiredPermission="accuracy"><AccuracyPage /></ProtectedRoute>} />
                    <Route path="/users" element={<ProtectedRoute requiredPermission="users"><UsersPage /></ProtectedRoute>} />
                    <Route path="/agents-online" element={<ProtectedRoute requiredRole={['admin', 'agent']} requiredPermission="agents_online"><AgentsOnline /></ProtectedRoute>} />
                    <Route path="/signup" element={<ProtectedRoute requiredRole="admin"><SignupPage /></ProtectedRoute>} />

                    <Route path="/encryption" element={<ProtectedRoute requiredPermission="encryption"><EncryptionPage /></ProtectedRoute>} />
                    <Route path="/notifications" element={<ProtectedRoute requiredPermission="notifications"><NotificationsPage /></ProtectedRoute>} />
                  </Routes>
                </main>
              </div>
            </BrowserRouter>
          </NotificationProvider>
        </SoundProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App

