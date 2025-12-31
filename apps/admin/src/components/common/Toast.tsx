import React, { useEffect } from 'react'

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  const bgColor = type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                   type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                   'bg-blue-50 border-blue-200 text-blue-800'

  return (
    <div className={`rounded-lg border p-2.5 shadow-lg ${bgColor} animate-slide-in min-w-[200px] max-w-[400px]`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium flex-1 break-words">{message}</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 focus:outline-none flex-shrink-0 mt-0.5"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

