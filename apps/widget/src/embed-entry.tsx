// apps/widget/src/embed-entry.tsx — Embeddable widget entry point
import React from 'react'
import { createRoot } from 'react-dom/client'
import EmbedWidget from './components/EmbedWidget'

// Global function for embedding
declare global {
  interface Window {
    AiSupportWidgetInit: (opts: {
      targetId: string
      apiBase?: string
      initialSessionId?: string
    }) => void
  }
}

window.AiSupportWidgetInit = function(opts: {
  targetId: string
  apiBase?: string
  initialSessionId?: string
}) {
  const { targetId, apiBase, initialSessionId } = opts
  
  const targetElement = document.getElementById(targetId)
  if (!targetElement) {
    console.error(`Target element with id "${targetId}" not found`)
    return
  }
  
  // Set API base URL if provided (for widget socket connection)
  if (apiBase) {
    // This would need to be passed to EmbedWidget via props or context
    // For now, EmbedWidget uses hardcoded localhost:4000
    // In production, you'd configure this via environment or props
    console.log('API Base:', apiBase)
  }
  
  const root = createRoot(targetElement)
  root.render(
    <React.StrictMode>
      <EmbedWidget initialSessionId={initialSessionId} />
    </React.StrictMode>
  )
}

// Auto-init if script tag has data attributes
if (document.currentScript) {
  const script = document.currentScript as HTMLScriptElement
  const targetId = script.getAttribute('data-target-id') || 'ai-support-widget'
  const apiBase = script.getAttribute('data-api-base')
  const sessionId = script.getAttribute('data-session-id')
  
  if (targetId) {
    window.AiSupportWidgetInit({
      targetId,
      apiBase: apiBase || undefined,
      initialSessionId: sessionId || undefined
    })
  }
}

export default window.AiSupportWidgetInit

