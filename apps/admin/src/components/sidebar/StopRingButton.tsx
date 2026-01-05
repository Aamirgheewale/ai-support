import { useSoundContext } from '../../context/SoundContext'

/**
 * StopRingButton - Floating button to stop ringing sounds
 * Only visible when a ring is actively playing
 * Fixed at the bottom of the sidebar
 * Uses shared SoundContext to see isRinging state from AudioNotifications
 */
export default function StopRingButton() {
  const { isRinging, stopAllSounds } = useSoundContext()

  // Only show when actively ringing
  if (!isRinging) return null

  return (
    <div className="fixed bottom-20 left-4 z-[9999]">
      <button
        onClick={stopAllSounds}
        className="flex items-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl shadow-lg transition-all animate-pulse"
        aria-label="Stop ringing"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
          />
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2.5} 
            d="M4 4l16 16" 
            className="text-white"
          />
        </svg>
        <span>Stop Ringing</span>
      </button>
    </div>
  )
}

