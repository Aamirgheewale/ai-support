import React, { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react'
import { useAuth, DEFAULT_USER_PREFS, UserPrefs } from '../hooks/useAuth'

interface SoundContextType {
  // Play functions
  playRing: (volumeOverride?: number) => Promise<void>
  playPop: (volumeOverride?: number) => Promise<void>
  playNotificationPop: (volumeOverride?: number) => Promise<void>
  // Stop functions
  stopRing: () => void
  stopPop: () => void
  stopAllSounds: () => void
  // State
  isRinging: boolean
  isPopPlaying: boolean
  audioEnabled: boolean
  settings: UserPrefs
  // Settings control
  setAudioEnabled: (enabled: boolean) => void
}

const SoundContext = createContext<SoundContextType | undefined>(undefined)

export function SoundProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  // State
  const [isRinging, setIsRinging] = useState(false)
  const [isPopPlaying, setIsPopPlaying] = useState(false)
  const [settings, setSettings] = useState<UserPrefs>(DEFAULT_USER_PREFS)

  // Audio refs
  const ringSoundRef = useRef<HTMLAudioElement | null>(null)
  const popSoundRef = useRef<HTMLAudioElement | null>(null)
  const ringRepeatCountRef = useRef(0)
  const ringRepeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Update settings when user.prefs changes
  useEffect(() => {
    if (user?.prefs) {
      setSettings({ ...DEFAULT_USER_PREFS, ...user.prefs })
    } else {
      setSettings(DEFAULT_USER_PREFS)
    }
  }, [user?.prefs])

  // Listen for prefs update events (for immediate updates before API response)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePrefsUpdate = (e: CustomEvent<UserPrefs>) => {
      setSettings({ ...DEFAULT_USER_PREFS, ...e.detail })
    }

    window.addEventListener('user-prefs-updated', handlePrefsUpdate as EventListener)

    return () => {
      window.removeEventListener('user-prefs-updated', handlePrefsUpdate as EventListener)
    }
  }, [])

  // Initialize audio objects
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      console.log('🔊 Initializing audio files...')

      ringSoundRef.current = new Audio('/sounds/Ring.mp3')
      ringSoundRef.current.preload = 'auto'

      // Add error handlers for audio loading
      ringSoundRef.current.addEventListener('error', (e) => {
        console.error('❌ Failed to load Ring.mp3:', e)
        console.error('   Audio error details:', {
          code: ringSoundRef.current?.error?.code,
          message: ringSoundRef.current?.error?.message
        })
      })

      ringSoundRef.current.addEventListener('canplaythrough', () => {
        console.log('✅ Ring.mp3 loaded and ready to play')
      })

      popSoundRef.current = new Audio('/sounds/pop.mp3')
      popSoundRef.current.preload = 'auto'

      popSoundRef.current.addEventListener('error', (e) => {
        console.error('❌ Failed to load pop.mp3:', e)
      })

      popSoundRef.current.addEventListener('canplaythrough', () => {
        console.log('✅ pop.mp3 loaded and ready to play')
      })

      // Track when ring ends
      ringSoundRef.current.addEventListener('ended', handleRingEnded)
      ringSoundRef.current.addEventListener('pause', () => {
        // Only set isRinging to false if we're not in the middle of a repeat
        if (ringRepeatCountRef.current >= (settings.repeatRing ?? 1)) {
          setIsRinging(false)
        }
      })

      // Track when pop ends
      popSoundRef.current.addEventListener('ended', () => setIsPopPlaying(false))
      popSoundRef.current.addEventListener('pause', () => setIsPopPlaying(false))

      console.log('✅ Audio initialization complete')
    } catch (err) {
      console.error('❌ Failed to initialize audio:', err)
    }

    // Cleanup
    return () => {
      if (ringRepeatTimeoutRef.current) {
        clearTimeout(ringRepeatTimeoutRef.current)
      }
      if (ringSoundRef.current) {
        ringSoundRef.current.pause()
        ringSoundRef.current = null
      }
      if (popSoundRef.current) {
        popSoundRef.current.pause()
        popSoundRef.current = null
      }
    }
  }, [])

  // Handle ring ended for repeat logic
  const handleRingEnded = useCallback(() => {
    ringRepeatCountRef.current++
    const repeatCount = settings.repeatRing ?? 1

    if (ringRepeatCountRef.current < repeatCount && ringSoundRef.current) {
      // Schedule next repeat
      ringRepeatTimeoutRef.current = setTimeout(() => {
        if (ringSoundRef.current && ringRepeatCountRef.current < repeatCount) {
          ringSoundRef.current.currentTime = 0
          ringSoundRef.current.play().catch(() => { })
        }
      }, 300)
    } else {
      // Done repeating
      setIsRinging(false)
    }
  }, [settings.repeatRing])

  // Update the ended handler when repeatRing changes
  useEffect(() => {
    if (ringSoundRef.current) {
      ringSoundRef.current.removeEventListener('ended', handleRingEnded)
      ringSoundRef.current.addEventListener('ended', handleRingEnded)
    }
  }, [handleRingEnded])

  // Play ring sound
  const playRing = useCallback(async (volumeOverride?: number) => {
    console.log('🔊 playRing called:', {
      masterEnabled: settings.masterEnabled,
      hasAudioRef: !!ringSoundRef.current,
      volume: volumeOverride ?? settings.newSessionRingVolume ?? 70,
      readyState: ringSoundRef.current?.readyState,
      networkState: ringSoundRef.current?.networkState,
      error: ringSoundRef.current?.error
    })

    if (!settings.masterEnabled) {
      console.warn('⚠️ playRing: Audio disabled (masterEnabled = false)')
      return
    }

    if (!ringSoundRef.current) {
      console.error('❌ playRing: Audio element not initialized (ringSoundRef.current is null)')
      return
    }

    // Check if audio has an error
    if (ringSoundRef.current.error) {
      console.error('❌ playRing: Audio has error:', {
        code: ringSoundRef.current.error.code,
        message: ringSoundRef.current.error.message
      })
      return
    }

    // Check if audio is ready to play
    if (ringSoundRef.current.readyState < 2) {
      console.warn('⚠️ playRing: Audio not ready (readyState:', ringSoundRef.current.readyState, ')')
      // Try to load the audio
      ringSoundRef.current.load()
      // Wait a bit for it to load
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Get volume: use override (for test buttons), or user pref, or default
    const volume = volumeOverride ?? settings.newSessionRingVolume ?? 70
    const decimalVolume = Math.max(0, Math.min(1, volume / 100))

    // CRUCIAL: Set volume BEFORE playing
    ringSoundRef.current.volume = decimalVolume
    console.log(`🔊 Ring volume set to ${volume}% (${decimalVolume})`)

    // Reset repeat counter
    ringRepeatCountRef.current = 0

    // Clear any pending repeat timeout
    if (ringRepeatTimeoutRef.current) {
      clearTimeout(ringRepeatTimeoutRef.current)
    }

    try {
      ringSoundRef.current.currentTime = 0
      setIsRinging(true)
      console.log('🔊 Attempting to play ring sound... (readyState:', ringSoundRef.current.readyState, ')')
      await ringSoundRef.current.play()
      console.log('✅ Ring sound playing successfully')
    } catch (err: any) {
      console.error('❌ Failed to play ring sound:', err)
      console.warn('💡 Audio may be blocked by browser autoplay policy. User interaction required.')
      console.warn('💡 Try clicking anywhere on the page first, then test again.')
      setIsRinging(false)
    }
  }, [settings.masterEnabled, settings.newSessionRingVolume])

  // Play pop sound
  const playPop = useCallback(async (volumeOverride?: number) => {
    if (!settings.masterEnabled || !popSoundRef.current) return

    // Get volume: use override (for test buttons), or user pref, or default
    const volume = volumeOverride ?? settings.newMessagePopVolume ?? 70
    const decimalVolume = Math.max(0, Math.min(1, volume / 100))

    // CRUCIAL: Set volume BEFORE playing
    popSoundRef.current.volume = decimalVolume

    try {
      popSoundRef.current.currentTime = 0
      setIsPopPlaying(true)
      await popSoundRef.current.play()
    } catch (err) {
      console.log('Audio play blocked - user interaction required')
      setIsPopPlaying(false)
    }
  }, [settings.masterEnabled, settings.newMessagePopVolume])

  // Play notification pop (different volume setting)
  const playNotificationPop = useCallback(async (volumeOverride?: number) => {
    if (!settings.masterEnabled || !popSoundRef.current) return

    const volume = volumeOverride ?? settings.notificationPopVolume ?? 70
    const decimalVolume = Math.max(0, Math.min(1, volume / 100))

    popSoundRef.current.volume = decimalVolume

    try {
      popSoundRef.current.currentTime = 0
      setIsPopPlaying(true)
      await popSoundRef.current.play()
    } catch (err) {
      console.log('Audio play blocked - user interaction required')
      setIsPopPlaying(false)
    }
  }, [settings.masterEnabled, settings.notificationPopVolume])

  // Stop ring sound
  const stopRing = useCallback(() => {
    // Clear any pending repeat timeout
    if (ringRepeatTimeoutRef.current) {
      clearTimeout(ringRepeatTimeoutRef.current)
      ringRepeatTimeoutRef.current = null
    }

    // Stop any pending repeats
    ringRepeatCountRef.current = 999

    // Pause and reset
    if (ringSoundRef.current) {
      ringSoundRef.current.pause()
      ringSoundRef.current.currentTime = 0
    }

    setIsRinging(false)
  }, [])

  // Stop pop sound
  const stopPop = useCallback(() => {
    if (popSoundRef.current) {
      popSoundRef.current.pause()
      popSoundRef.current.currentTime = 0
    }
    setIsPopPlaying(false)
  }, [])

  // Stop ALL sounds (does NOT change masterEnabled)
  const stopAllSounds = useCallback(() => {
    stopRing()
    stopPop()
  }, [stopRing, stopPop])

  // Set audio enabled/disabled
  const setAudioEnabled = useCallback((enabled: boolean) => {
    setSettings(prev => ({ ...prev, masterEnabled: enabled }))
    // Also dispatch event for immediate UI updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('user-prefs-updated', {
        detail: { ...settings, masterEnabled: enabled }
      }))
    }
  }, [settings])

  return (
    <SoundContext.Provider value={{
      playRing,
      playPop,
      playNotificationPop,
      stopRing,
      stopPop,
      stopAllSounds,
      isRinging,
      isPopPlaying,
      audioEnabled: settings.masterEnabled ?? true,
      settings,
      setAudioEnabled
    }}>
      {children}
    </SoundContext.Provider>
  )
}

export function useSoundContext() {
  const context = useContext(SoundContext)
  if (context === undefined) {
    throw new Error('useSoundContext must be used within a SoundProvider')
  }
  return context
}

