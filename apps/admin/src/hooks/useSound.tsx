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
  const [audioEnabled, setAudioEnabled] = useState(false)
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

  // Enable audio on first user interaction (click, touch, keypress)
  useEffect(() => {
    if (userInteracted || !enabled) return

    const enableAudio = () => {
      setUserInteracted(true)
      setAudioEnabled(true)
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
    if (!enabled || !audioEnabled || !ringSoundRef.current) return
    
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
    if (!enabled || !audioEnabled || !popSoundRef.current) return
    
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
    setAudioEnabled
  }
}

