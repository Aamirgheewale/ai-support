import { useRef, useEffect, useState } from 'react'

interface UseSoundOptions {
  enabled?: boolean
  volume?: number
}

/**
 * Custom hook for playing audio notifications
 * Handles browser autoplay policy by requiring user interaction
 */
export function useSound(options: UseSoundOptions = {}) {
  const { enabled = true, volume = 0.7 } = options
  
  // Load audio enabled state from localStorage (shared across all instances)
  const getStoredAudioEnabled = () => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem('ai-support-audio-enabled')
    return stored === 'true'
  }
  
  const [audioEnabled, setAudioEnabled] = useState(getStoredAudioEnabled)
  const [userInteracted, setUserInteracted] = useState(false)
  
  const ringSoundRef = useRef<HTMLAudioElement | null>(null)
  const popSoundRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio objects
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      ringSoundRef.current = new Audio('/sounds/Ring.mp3')
      ringSoundRef.current.volume = volume
      ringSoundRef.current.preload = 'auto'
      
      popSoundRef.current = new Audio('/sounds/pop.mp3')
      popSoundRef.current.volume = volume
      popSoundRef.current.preload = 'auto'
    } catch (err) {
      console.warn('Failed to initialize audio:', err)
    }

    // Cleanup
    return () => {
      if (ringSoundRef.current) {
        ringSoundRef.current.pause()
        ringSoundRef.current = null
      }
      if (popSoundRef.current) {
        popSoundRef.current.pause()
        popSoundRef.current = null
      }
    }
  }, [volume])

  // Custom setAudioEnabled that updates both state and localStorage
  const updateAudioEnabled = (value: boolean) => {
    setAudioEnabled(value)
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai-support-audio-enabled', String(value))
      // Dispatch custom event for same-tab synchronization
      window.dispatchEvent(new CustomEvent('audio-enabled-changed', { detail: value }))
    }
  }

  // Listen for audio enabled changes (from other components in same tab)
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleAudioEnabledChange = (e: CustomEvent) => {
      setAudioEnabled(e.detail)
    }
    
    // Listen for storage events (when other tabs update it)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ai-support-audio-enabled') {
        setAudioEnabled(e.newValue === 'true')
      }
    }
    
    window.addEventListener('audio-enabled-changed', handleAudioEnabledChange as EventListener)
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('audio-enabled-changed', handleAudioEnabledChange as EventListener)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // Enable audio on first user interaction (click, touch, keypress)
  useEffect(() => {
    if (userInteracted || !enabled) return

    const enableAudio = () => {
      setUserInteracted(true)
      updateAudioEnabled(true)
    }

    const events = ['click', 'touchstart', 'keydown']
    events.forEach(event => {
      document.addEventListener(event, enableAudio, { once: true })
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, enableAudio)
      })
    }
  }, [enabled, userInteracted])

  const playRing = async () => {
    // Check localStorage for current audio enabled state (shared across components)
    const isAudioEnabled = typeof window !== 'undefined' && localStorage.getItem('ai-support-audio-enabled') === 'true'
    if (!enabled || !isAudioEnabled || !ringSoundRef.current) return
    
    try {
      // Reset to start if already playing
      if (ringSoundRef.current.currentTime > 0) {
        ringSoundRef.current.currentTime = 0
      }
      await ringSoundRef.current.play()
    } catch (err) {
      // Autoplay blocked - user needs to interact first
      console.log('Audio play blocked - user interaction required')
    }
  }

  const playPop = async () => {
    // Check localStorage for current audio enabled state (shared across components)
    const isAudioEnabled = typeof window !== 'undefined' && localStorage.getItem('ai-support-audio-enabled') === 'true'
    if (!enabled || !isAudioEnabled || !popSoundRef.current) return
    
    try {
      // Reset to start if already playing
      if (popSoundRef.current.currentTime > 0) {
        popSoundRef.current.currentTime = 0
      }
      await popSoundRef.current.play()
    } catch (err) {
      // Autoplay blocked - user needs to interact first
      console.log('Audio play blocked - user interaction required')
    }
  }

  const pauseRing = () => {
    if (ringSoundRef.current) {
      ringSoundRef.current.pause()
      ringSoundRef.current.currentTime = 0
    }
  }

  const pausePop = () => {
    if (popSoundRef.current) {
      popSoundRef.current.pause()
      popSoundRef.current.currentTime = 0
    }
  }

  const isRingPlaying = () => {
    return ringSoundRef.current ? !ringSoundRef.current.paused : false
  }

  const isPopPlaying = () => {
    return popSoundRef.current ? !popSoundRef.current.paused : false
  }

  return {
    playRing,
    playPop,
    pauseRing,
    pausePop,
    isRingPlaying,
    isPopPlaying,
    audioEnabled,
    setAudioEnabled: updateAudioEnabled
  }
}

