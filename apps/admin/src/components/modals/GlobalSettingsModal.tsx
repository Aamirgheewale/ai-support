import { useState, useEffect, useRef } from 'react'
import { Volume2, VolumeX, Bell, PlayCircle, PauseCircle, Loader2, X } from 'lucide-react'
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
          className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sounds & Notifications</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Settings are saved to your account</p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400 dark:hover:text-gray-200" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Master Sound Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${settings.masterEnabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  {settings.masterEnabled ? (
                    <Volume2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Master Sound</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Enable or disable all sounds</p>
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
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Desktop Notifications</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Show browser notifications</p>
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
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Volume Controls</h3>
            </div>

            {/* New Session Ring Volume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">New Session Ring</span>
                  <button
                    onClick={toggleRingTest}
                    className={`p-1.5 rounded transition-colors ${
                      ringPlaying 
                        ? 'bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500'
                    }`}
                    title={ringPlaying ? 'Stop sound' : 'Test sound'}
                    disabled={!settings.masterEnabled}
                  >
                    {ringPlaying ? (
                      <PauseCircle className="w-4 h-4" />
                    ) : (
                      <PlayCircle className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{settings.newSessionRingVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.newSessionRingVolume}
                onChange={(e) => updateSetting('newSessionRingVolume', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-400"
                disabled={!settings.masterEnabled}
              />
            </div>

            {/* Repeat Ring */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Repeat Ring</span>
              <select
                value={settings.repeatRing}
                onChange={(e) => updateSetting('repeatRing', parseInt(e.target.value))}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">New Message Pop</span>
                  <button
                    onClick={togglePopTest}
                    className={`p-1.5 rounded transition-colors ${
                      popPlaying 
                        ? 'bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500'
                    }`}
                    title={popPlaying ? 'Stop sound' : 'Test sound'}
                    disabled={!settings.masterEnabled}
                  >
                    {popPlaying ? (
                      <PauseCircle className="w-4 h-4" />
                    ) : (
                      <PlayCircle className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{settings.newMessagePopVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.newMessagePopVolume}
                onChange={(e) => updateSetting('newMessagePopVolume', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-400"
                disabled={!settings.masterEnabled}
              />
            </div>

            {/* Notification Pop Volume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Notification Pop</span>
                  <button
                    onClick={testNotificationPop}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-400 dark:text-gray-500"
                    title="Test sound"
                    disabled={!settings.masterEnabled}
                  >
                    <PlayCircle className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{settings.notificationPopVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.notificationPopVolume}
                onChange={(e) => updateSetting('notificationPopVolume', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-400"
                disabled={!settings.masterEnabled}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
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
