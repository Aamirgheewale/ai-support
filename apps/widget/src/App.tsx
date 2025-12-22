import { useState, useEffect } from 'react';
import EmbedWidget from './components/EmbedWidget';

// Wrapper component with circular button - this is the entire app now
function ChatWidgetWithButton({ initialSessionId }: { initialSessionId?: string }) {
  const [chatWidgetOpen, setChatWidgetOpen] = useState(false);

  // Send postMessage when chat opens/closes (for iframe embedding)
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
      width: '100vw',
      height: '100vh',
      position: 'fixed',
      top: 0,
      left: 0,
      overflow: 'hidden',
      pointerEvents: 'none'
    }}>
      {/* Floating Chat Button - Circular */}
      {!chatWidgetOpen && (
        <button
          onClick={() => setChatWidgetOpen(true)}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '70px',
            height: '70px',
            borderRadius: '50%',
            background: '#000000',
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
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '380px',
          height: '650px',
          maxWidth: '100vw',
          maxHeight: '100vh',
          zIndex: 10001,
          animation: 'slideUp 0.3s ease-out',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          pointerEvents: 'auto',
          boxSizing: 'border-box',
          overflow: 'hidden'
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

function App() {
  return <ChatWidgetWithButton />;
}

export default App;
