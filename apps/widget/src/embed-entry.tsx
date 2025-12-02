// apps/widget/src/embed-entry.tsx — Embeddable widget entry point
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import EmbedWidget from './components/EmbedWidget'

// Wrapper component with circular button
function ChatWidgetWithButton({ initialSessionId }: { initialSessionId?: string }) {
  const [chatWidgetOpen, setChatWidgetOpen] = useState(false);

  return (
    <>
      {/* Floating Chat Button - Circular */}
      {!chatWidgetOpen && (
        <button
          onClick={() => setChatWidgetOpen(true)}
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            width: '70px',
            height: '70px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #000000 0%, #ffffff 100%)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 20px rgba(255, 255, 255, 0.1)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            transition: 'all 0.3s ease',
            color: '#ffffff',
            fontSize: '24px',
            fontWeight: 'bold'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 25px rgba(0, 0, 0, 0.4), 0 0 30px rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 20px rgba(255, 255, 255, 0.1)';
          }}
          aria-label="Open chat"
        >
          💬
        </button>
      )}

      {/* Chat Widget Popup */}
      {chatWidgetOpen && (
        <div style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          zIndex: 10001,
          animation: 'slideUp 0.3s ease-out'
        }}>
          {/* Close button */}
          <button
            onClick={() => setChatWidgetOpen(false)}
            style={{
              position: 'absolute',
              top: '-15px',
              right: '-15px',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #000000 0%, #ffffff 100%)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              color: '#ffffff',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
              zIndex: 10002,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'rotate(90deg) scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'rotate(0deg) scale(1)';
            }}
            aria-label="Close chat"
          >
            ×
          </button>
          {/* Chat widget */}
          <EmbedWidget initialSessionId={initialSessionId} />
        </div>
      )}

      {/* Add CSS animation for slide up effect */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

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
      <ChatWidgetWithButton initialSessionId={initialSessionId} />
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

