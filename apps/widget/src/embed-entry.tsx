// apps/widget/src/embed-entry.tsx — Embeddable widget entry point
import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import EmbedWidget from './components/EmbedWidget'

// Wrapper component with circular button
function ChatWidgetWithButton({ initialSessionId }: { initialSessionId?: string }) {
  const [chatWidgetOpen, setChatWidgetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Send postMessage when chat opens/closes
  useEffect(() => {
    if (window.parent && window.parent !== window) {
      if (chatWidgetOpen) {
        window.parent.postMessage('chat-opened', '*');
      } else {
        window.parent.postMessage('chat-closed', '*');
      }
    }
  }, [chatWidgetOpen]);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Floating Chat Button - Circular */}
      {!chatWidgetOpen && (
        <button
          onClick={() => setChatWidgetOpen(true)}
          style={{
            position: 'absolute',
            bottom: '0',
            right: '0',
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
            fontWeight: 'bold',
            pointerEvents: 'auto'
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
          position: 'absolute',
          bottom: 0,
          right: 0,
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          zIndex: 10001,
          animation: 'slideUp 0.3s ease-out',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          pointerEvents: 'auto'
        }}>
          {/* Chat widget */}
          <EmbedWidget 
            initialSessionId={initialSessionId}
            onAgentInitiatedChat={() => setChatWidgetOpen(true)}
            onClose={() => setChatWidgetOpen(false)}
          />
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
    </div>
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

