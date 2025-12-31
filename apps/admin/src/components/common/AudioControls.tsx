import { useState, useEffect } from 'react'
import { useSound } from '../../hooks/useSound'

/**
 * Audio controls component for sidebar
 * Displays enable/disable toggle and test buttons
 */
export default function AudioControls() {
  const { 
    playRing, 
    playPop, 
    pauseRing, 
    pausePop, 
    isRingPlaying, 
    isPopPlaying, 
    audioEnabled, 
    setAudioEnabled 
  } = useSound({ enabled: true })
  const [ringPlaying, setRingPlaying] = useState(false)
  const [popPlaying, setPopPlaying] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // Check playing state periodically for UI updates
  useEffect(() => {
    if (!audioEnabled) return

    const interval = setInterval(() => {
      setRingPlaying(isRingPlaying())
      setPopPlaying(isPopPlaying())
    }, 100) // Check every 100ms for smooth UI updates

    return () => clearInterval(interval)
  }, [audioEnabled, isRingPlaying, isPopPlaying])

  const handleTestRing = () => {
    if (ringPlaying) {
      pauseRing()
    } else {
      playRing()
    }
  }

  const handleTestPop = () => {
    if (popPlaying) {
      pausePop()
    } else {
      playPop()
    }
  }

  return (
    <div className="px-4 py-3 border-t border-gray-200">
      {/* Audio Enable/Disable Toggle */}
      {!audioEnabled ? (
        <button
          onClick={() => setAudioEnabled(true)}
          className="flex items-center justify-center w-full px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <span>Enable Audio</span>
        </button>
      ) : (
        <div className="space-y-2">
          {/* Audio Status and Disable Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-500 text-sm">🔊</span>
              <span className="text-xs font-medium text-gray-700">Audio On</span>
            </div>
            <button
              onClick={() => setAudioEnabled(false)}
              className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
              title="Disable audio notifications"
            >
              Disable
            </button>
          </div>

          {/* Expandable Test Controls */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
            >
              <span>Test Sounds</span>
              <svg 
                className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {isExpanded && (
              <div className="p-2 bg-white border-t border-gray-200 flex items-center gap-2">
                <button
                  onClick={handleTestRing}
                  className={`flex-1 px-2 py-1.5 text-white text-xs rounded flex items-center justify-center gap-1 ${
                    ringPlaying
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                  title={ringPlaying ? "Pause ring sound" : "Play ring sound (new session)"}
                >
                  {ringPlaying ? '⏸️' : '🔔'} Ring
                </button>
                <button
                  onClick={handleTestPop}
                  className={`flex-1 px-2 py-1.5 text-white text-xs rounded flex items-center justify-center gap-1 ${
                    popPlaying
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                  title={popPlaying ? "Pause pop sound" : "Play pop sound (agent message)"}
                >
                  {popPlaying ? '⏸️' : '🔊'} Pop
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

