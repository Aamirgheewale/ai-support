import { useRef, useEffect, useState, useCallback } from 'react'
import { useAuth, DEFAULT_USER_PREFS, UserPrefs } from './useAuth'

interface UseSoundOptions {
  enabled?: boolean
  volume?: number
}

/**
 * Custom hook for playing audio notifications
 * Reads settings from user.prefs (Appwrite) - isolated per user
 * Falls back to defaults if no user is logged in
 * 
 * NOTE: For components that need isRinging state and stopAllSounds,
 * use useSoundContext from context/SoundContext.tsx instead
 */
export function useSound(options: UseSoundOptions = {}) {
  const { enabled = true } = options
  const { user } = useAuth()
  
  // Get settings from user.prefs or defaults
  const getSettings = useCallback((): UserPrefs => {
    if (user?.prefs) {
      return { ...DEFAULT_USER_PREFS, ...user.prefs }
    }
    return DEFAULT_USER_PREFS
  }, [user?.prefs])

  const [settings, setSettings] = useState<UserPrefs>(getSettings)
  const [isRinging, setIsRinging] = useState(false)
  const [isPopPlaying, setIsPopPlaying] = useState(false)
  
  const ringSoundRef = useRef<HTMLAudioElement | null>(null)
  const popSoundRef = useRef<HTMLAudioElement | null>(null)
  const ringRepeatCountRef = useRef(0)
  const ringRepeatTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Update settings when user.prefs changes
  useEffect(() => {
    setSettings(getSettings())
  }, [getSettings])

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
      ringSoundRef.current = new Audio('/sounds/Ring.mp3')
      ringSoundRef.current.preload = 'auto'
      
      popSoundRef.current = new Audio('/sounds/pop.mp3')
      popSoundRef.current.preload = 'auto'
    } catch (err) {
      console.warn('Failed to initialize audio:', err)
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

  // Play ring sound with volume from settings or override
  const playRing = useCallback(async (volumeOverride?: number) => {
    if (!enabled || !settings.masterEnabled || !ringSoundRef.current) return
    
    // Get volume: use override (for test buttons with live preview), or user pref, or default
    const volume = volumeOverride ?? settings.newSessionRingVolume ?? 70
    // CRUCIAL: Convert 0-100 to 0.0-1.0
    const decimalVolume = Math.max(0, Math.min(1, volume / 100))
    
    // Set volume BEFORE playing
    ringSoundRef.current.volume = decimalVolume
    
    // Reset repeat counter
    ringRepeatCountRef.current = 0
    
    // Clear any pending repeat timeout
    if (ringRepeatTimeoutRef.current) {
      clearTimeout(ringRepeatTimeoutRef.current)
    }
    
    const playOnce = async () => {
      if (!ringSoundRef.current) return
      
      try {
        ringSoundRef.current.currentTime = 0
        setIsRinging(true)
        await ringSoundRef.current.play()
      } catch (err) {
        console.log('Audio play blocked - user interaction required')
        setIsRinging(false)
      }
    }
    
    // Set up repeat logic
    const handleEnded = () => {
      ringRepeatCountRef.current++
      const repeatCount = settings.repeatRing ?? 1
      if (ringRepeatCountRef.current < repeatCount && ringSoundRef.current) {
        ringRepeatTimeoutRef.current = setTimeout(() => {
          playOnce()
        }, 300)
      } else {
        setIsRinging(false)
      }
    }
    
    // Remove old listener and add new one
    if (ringSoundRef.current) {
      ringSoundRef.current.removeEventListener('ended', handleEnded)
      ringSoundRef.current.addEventListener('ended', handleEnded)
    }
    
    await playOnce()
  }, [enabled, settings])

  // Play pop sound with volume from settings or override
  const playPop = useCallback(async (volumeOverride?: number) => {
    if (!enabled || !settings.masterEnabled || !popSoundRef.current) return
    
    // Get volume: use override (for test buttons with live preview), or user pref, or default
    const volume = volumeOverride ?? settings.newMessagePopVolume ?? 70
    // CRUCIAL: Convert 0-100 to 0.0-1.0
    const decimalVolume = Math.max(0, Math.min(1, volume / 100))
    
    // Set volume BEFORE playing
    popSoundRef.current.volume = decimalVolume
    
    try {
      popSoundRef.current.currentTime = 0
      setIsPopPlaying(true)
      await popSoundRef.current.play()
      
      // Track when pop ends
      popSoundRef.current.onended = () => setIsPopPlaying(false)
    } catch (err) {
      console.log('Audio play blocked - user interaction required')
      setIsPopPlaying(false)
    }
  }, [enabled, settings])

  // Play notification pop with notification volume
  const playNotificationPop = useCallback(async (volumeOverride?: number) => {
    if (!enabled || !settings.masterEnabled || !popSoundRef.current) return
    
    const volume = volumeOverride ?? settings.notificationPopVolume ?? 70
    const decimalVolume = Math.max(0, Math.min(1, volume / 100))
    
    popSoundRef.current.volume = decimalVolume
    
    try {
      popSoundRef.current.currentTime = 0
      setIsPopPlaying(true)
      await popSoundRef.current.play()
      
      popSoundRef.current.onended = () => setIsPopPlaying(false)
    } catch (err) {
      console.log('Audio play blocked - user interaction required')
      setIsPopPlaying(false)
    }
  }, [enabled, settings])

  // Stop ring sound (does NOT change masterEnabled)
  const pauseRing = useCallback(() => {
    // Clear any pending repeat timeout
    if (ringRepeatTimeoutRef.current) {
      clearTimeout(ringRepeatTimeoutRef.current)
      ringRepeatTimeoutRef.current = null
    }
    
    // Stop any pending repeats
    ringRepeatCountRef.current = 999
    
    if (ringSoundRef.current) {
      ringSoundRef.current.pause()
      ringSoundRef.current.currentTime = 0
    }
    setIsRinging(false)
  }, [])

  // Stop pop sound
  const pausePop = useCallback(() => {
    if (popSoundRef.current) {
      popSoundRef.current.pause()
      popSoundRef.current.currentTime = 0
    }
    setIsPopPlaying(false)
  }, [])

  // Stop ALL sounds (does NOT change masterEnabled)
  const stopAllSounds = useCallback(() => {
    pauseRing()
    pausePop()
  }, [pauseRing, pausePop])

  const isRingPlayingFn = useCallback(() => {
    return ringSoundRef.current ? !ringSoundRef.current.paused : false
  }, [])

  const isPopPlayingFn = useCallback(() => {
    return popSoundRef.current ? !popSoundRef.current.paused : false
  }, [])

  return {
    playRing,
    playPop,
    playNotificationPop,
    pauseRing,
    pausePop,
    stopAllSounds,
    isRingPlaying: isRingPlayingFn,
    isPopPlaying: isPopPlayingFn,
    isRinging,
    audioEnabled: settings.masterEnabled ?? true,
    settings
  }
}
