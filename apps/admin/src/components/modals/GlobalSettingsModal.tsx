import { useState, useEffect, useRef } from 'react'
import { useAuth, DEFAULT_USER_PREFS, UserPrefs } from '../../hooks/useAuth'
import { useSoundContext } from '../../context/SoundContext'

interface GlobalSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * GlobalSettingsModal - Modal for sound and notification settings
 * Persists to Appwrite user preferences (isolated per user)
 * Uses shared SoundContext for play/stop functionality
 */
export default function GlobalSettingsModal({ isOpen, onClose }: GlobalSettingsModalProps) {
  const { user, updateUserSettings } = useAuth()
  const { playRing, playPop, stopRing, stopPop, isRinging, isPopPlaying } = useSoundContext()
  
  // Form state initialized from user.prefs
  const [settings, setSettings] = useState<UserPrefs>(DEFAULT_USER_PREFS)
  const [originalSettings, setOriginalSettings] = useState<UserPrefs>(DEFAULT_USER_PREFS)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [isTestingRing, setIsTestingRing] = useState(false)
  const [isTestingPop, setIsTestingPop] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Load settings from user.prefs when modal opens
  useEffect(() => {
    if (isOpen && user) {
      const userPrefs = { ...DEFAULT_USER_PREFS, ...user.prefs }
      setSettings(userPrefs)
      setOriginalSettings(userPrefs)
    }
  }, [isOpen, user])

  // Track when ring/pop stop playing
  useEffect(() => {
    if (!isRinging && isTestingRing) {
      setIsTestingRing(false)
    }
  }, [isRinging, isTestingRing])

  useEffect(() => {
    if (!isPopPlaying && isTestingPop) {
      setIsTestingPop(false)
    }
  }, [isPopPlaying, isTestingPop])

  // Check for changes
  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings)
    setHasChanges(changed)
  }, [settings, originalSettings])

  // Close on escape key and stop any playing sounds
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopRing()
        stopPop()
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose, stopRing, stopPop])

  // Stop sounds when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopRing()
      stopPop()
      setIsTestingRing(false)
      setIsTestingPop(false)
    }
  }, [isOpen, stopRing, stopPop])

  // Update a single setting
  const updateSetting = <K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // Request desktop notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        updateSetting('desktopNotifications', true)
      }
    }
  }

  // Toggle ring sound test (play/stop)
  const toggleRingTest = () => {
    if (isTestingRing || isRinging) {
      stopRing()
      setIsTestingRing(false)
    } else {
      // Play with current slider volume (live preview)
      playRing(settings.newSessionRingVolume)
      setIsTestingRing(true)
    }
  }

  // Toggle pop sound test (play/stop)
  const togglePopTest = () => {
    if (isTestingPop || isPopPlaying) {
      stopPop()
      setIsTestingPop(false)
    } else {
      // Play with current slider volume (live preview)
      playPop(settings.newMessagePopVolume)
      setIsTestingPop(true)
    }
  }

  // Test notification pop with its own volume
  const testNotificationPop = () => {
    playPop(settings.notificationPopVolume)
  }

  // Save settings to Appwrite user preferences
  const handleSave = async () => {
    // Stop any playing sounds
    stopRing()
    stopPop()
    
    setIsSaving(true)

    try {
      // Save to Appwrite via useAuth hook
      const success = await updateUserSettings(settings)
      
      if (success) {
        setOriginalSettings(settings)
        onClose()
      } else {
        console.error('Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Cancel and restore original settings
  const handleCancel = () => {
    stopRing()
    stopPop()
    setSettings(originalSettings)
    onClose()
  }

  if (!isOpen) return null

  const ringPlaying = isTestingRing || isRinging
  const popPlaying = isTestingPop || isPopPlaying

  return (
    <div 
      className="fixed inset-0 z-[10000] overflow-y-auto" 
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop - below profile menu, no blur (profile menu backdrop already provides blur) */}
      <div className="fixed inset-0 bg-black/50 z-[10000]" />

      {/* Modal Container - above profile menu */}
      <div className="flex items-center justify-center min-h-screen p-4 relative z-[10002]">
        <div
          ref={modalRef}
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Sounds & Notifications</h2>
                <p className="text-xs text-gray-500">Settings are saved to your account</p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Master Sound Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${settings.masterEnabled ? 'bg-green-100' : 'bg-gray-200'}`}>
                  {settings.masterEnabled ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zm11-4l4-4m0 4l-4-4" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Master Sound</h3>
                  <p className="text-xs text-gray-500">Enable or disable all sounds</p>
                </div>
              </div>
              <button
                onClick={() => updateSetting('masterEnabled', !settings.masterEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors ${settings.masterEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.masterEnabled ? 'translate-x-6' : 'translate-x-0'}`}
                />
              </button>
            </div>

            {/* Desktop Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Desktop Notifications</h3>
                  <p className="text-xs text-gray-500">Show browser notifications</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!settings.desktopNotifications) {
                    requestNotificationPermission()
                  } else {
                    updateSetting('desktopNotifications', false)
                  }
                }}
                className={`relative w-12 h-6 rounded-full transition-colors ${settings.desktopNotifications ? 'bg-blue-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.desktopNotifications ? 'translate-x-6' : 'translate-x-0'}`}
                />
              </button>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Volume Controls</h3>
            </div>

            {/* New Session Ring Volume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">New Session Ring</span>
                  <button
                    onClick={toggleRingTest}
                    className={`p-1.5 rounded transition-colors ${
                      ringPlaying 
                        ? 'bg-red-100 hover:bg-red-200 text-red-600' 
                        : 'hover:bg-gray-100 text-gray-400'
                    }`}
                    title={ringPlaying ? 'Stop sound' : 'Test sound'}
                    disabled={!settings.masterEnabled}
                  >
                    {ringPlaying ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                </div>
                <span className="text-sm text-gray-500">{settings.newSessionRingVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.newSessionRingVolume}
                onChange={(e) => updateSetting('newSessionRingVolume', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                disabled={!settings.masterEnabled}
              />
            </div>

            {/* Repeat Ring */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Repeat Ring</span>
              <select
                value={settings.repeatRing}
                onChange={(e) => updateSetting('repeatRing', parseInt(e.target.value))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                disabled={!settings.masterEnabled}
              >
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={3}>3x</option>
                <option value={4}>4x</option>
                <option value={5}>5x</option>
              </select>
            </div>

            {/* New Message Pop Volume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">New Message Pop</span>
                  <button
                    onClick={togglePopTest}
                    className={`p-1.5 rounded transition-colors ${
                      popPlaying 
                        ? 'bg-red-100 hover:bg-red-200 text-red-600' 
                        : 'hover:bg-gray-100 text-gray-400'
                    }`}
                    title={popPlaying ? 'Stop sound' : 'Test sound'}
                    disabled={!settings.masterEnabled}
                  >
                    {popPlaying ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                </div>
                <span className="text-sm text-gray-500">{settings.newMessagePopVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.newMessagePopVolume}
                onChange={(e) => updateSetting('newMessagePopVolume', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                disabled={!settings.masterEnabled}
              />
            </div>

            {/* Notification Pop Volume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Notification Pop</span>
                  <button
                    onClick={testNotificationPop}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-400"
                    title="Test sound"
                    disabled={!settings.masterEnabled}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
                <span className="text-sm text-gray-500">{settings.notificationPopVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.notificationPopVolume}
                onChange={(e) => updateSetting('notificationPopVolume', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                disabled={!settings.masterEnabled}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
