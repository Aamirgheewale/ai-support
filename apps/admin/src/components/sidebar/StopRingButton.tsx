import { BellOff } from 'lucide-react'
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
        <BellOff className="w-5 h-5" />
        <span>Stop Ringing</span>
      </button>
    </div>
  )
}

