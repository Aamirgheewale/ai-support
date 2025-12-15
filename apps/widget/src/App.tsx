import { useState, useEffect, useRef } from 'react';
import EmbedWidget from './components/EmbedWidget';

function App() {
  const [servicesOpen, setServicesOpen] = useState(false);
  const servicesRef = useRef<HTMLDivElement>(null);
  const [chatWidgetOpen, setChatWidgetOpen] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (servicesRef.current && !servicesRef.current.contains(event.target as Node)) {
        setServicesOpen(false);
      }
    }

    if (servicesOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [servicesOpen]);

  return (
    <div style={{ 
      width: '100%', 
      minHeight: '100vh', 
      background: '#000000',
      position: 'relative',
      overflow: 'visible'
    }}>
      {/* Header with glass effect rectangles */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '24px 0',
        zIndex: 100,
        gap: '20px',
        overflow: 'visible',
        pointerEvents: 'auto',
        background: 'transparent'
      }}>
        {/* Wreath background - behind left rectangle only */}
        <div style={{
          position: 'absolute',
          top: '0',
          left: '0',
          width: '250px',
          height: 'auto',
          zIndex: 0,
          pointerEvents: 'none',
          marginTop: '0',
          paddingTop: '0'
        }}>
          <img 
            src="/wreath.png" 
            alt="Wreath" 
            style={{ 
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
              opacity: 0.9,
              transform: 'rotate(180deg)',
              marginTop: '0',
              paddingTop: '0'
            }} 
          />
        </div>

        {/* Wreath background - behind right rectangle only */}
        <div style={{
          position: 'absolute',
          top: '0',
          right: '0',
          width: '250px',
          height: 'auto',
          zIndex: 0,
          pointerEvents: 'none',
          marginTop: '0',
          paddingTop: '0'
        }}>
          <img 
            src="/wreath.png" 
            alt="Wreath" 
            style={{ 
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
              opacity: 0.9,
              transform: 'rotate(145deg)',
              marginTop: '0',
              paddingTop: '0'
            }} 
          />
        </div>

        {/* Left Rectangle - ChatBot */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '0 20px 20px 0',
          padding: '18px 32px',
          flex: '0 0 auto',
          position: 'relative',
          zIndex: 1
        }}>
          <span style={{ color: '#ffffff', fontSize: '20px', fontWeight: 500 }}>ChatBot</span>
        </div>

        {/* Center - CeBe Heading */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{
            position: 'relative',
            display: 'inline-block',
            padding: '16px 32px'
          }}>
            {/* Glass effect background */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '16px',
              zIndex: 0
            }} />
            {/* CeBe Text */}
            <h1 style={{ 
              color: '#ffffff', 
              fontSize: '48px',
              fontWeight: 400,
              fontFamily: "'Bungee Shade', cursive",
              margin: 0,
              letterSpacing: '2px',
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)',
              textTransform: 'uppercase',
              position: 'relative',
              zIndex: 1
            }}>
              CeBe
            </h1>
          </div>
        </div>

        {/* Right Rectangle - Home, Services, Logo */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '20px 0 0 20px',
          padding: '18px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          flex: '0 0 auto',
          position: 'relative',
          zIndex: 1
        }}>
          <a 
            href="/" 
            style={{ 
              color: '#ffffff', 
              textDecoration: 'none',
              fontSize: '20px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Home
          </a>
          <a 
            href="/preview.html" 
            style={{ 
              color: '#ffffff', 
              textDecoration: 'none',
              fontSize: '20px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Widget Preview
          </a>
          <div ref={servicesRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setServicesOpen(!servicesOpen)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '20px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: 0
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Services
              <span style={{ fontSize: '14px' }}>{servicesOpen ? '▲' : '▼'}</span>
            </button>
            {servicesOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '8px 0',
                minWidth: '150px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                zIndex: 1002
              }}>
                <a 
                  href="#" 
                  onClick={() => setServicesOpen(false)}
                  style={{ display: 'block', padding: '8px 16px', color: '#ffffff', textDecoration: 'none', fontSize: '14px' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Service 1
                </a>
                <a 
                  href="#" 
                  onClick={() => setServicesOpen(false)}
                  style={{ display: 'block', padding: '8px 16px', color: '#ffffff', textDecoration: 'none', fontSize: '14px' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Service 2
                </a>
                <a 
                  href="#" 
                  onClick={() => setServicesOpen(false)}
                  style={{ display: 'block', padding: '8px 16px', color: '#ffffff', textDecoration: 'none', fontSize: '14px' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Service 3
                </a>
              </div>
            )}
          </div>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {/* Particle splash behind logo */}
            {/* <img 
              src="/particle-splash.png" 
              alt="Particle Splash" 
              style={{ 
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '60px',
                height: '60px',
                objectFit: 'contain',
                zIndex: 0,
                opacity: 0.8
              }} 
            /> */}
            {/* Robot Logo */}
            <img 
              src="/cebe-face.png" 
              alt="Robot Logo" 
              style={{ 
                width: '40px', 
                height: '40px',
                objectFit: 'contain',
                position: 'relative',
                zIndex: 1
              }} 
            />
          </div>
        </div>
      </div>

      <div style={{ 
        maxWidth: 1200, 
        margin: '0 auto', 
        marginTop: '100px',
        padding: '20px',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Hero Image */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          marginTop: '0px',
          marginBottom: '40px',
          position: 'relative'
        }}>
          {/* Particle splash behind hero */}
          {/* <img 
            src="/particle-splash.png" 
            alt="Particle Splash" 
            style={{ 
              position: 'absolute',
              top: '50%',
              left: '30%',
              transform: 'translate(-50%, -50%)',
              width: '600px',
              height: 'auto',
              objectFit: 'contain',
              zIndex: 0,
              opacity: 0.8,
              pointerEvents: 'none'
            }} 
          /> */}
          {/* White glowing ellipse behind hero */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '550px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255, 255, 255, 0.4) 0%, rgba(59, 130, 246, 0.3) 50%, transparent 100%)',
            filter: 'blur(40px)',
            WebkitFilter: 'blur(40px)',
            zIndex: 0.5,
            pointerEvents: 'none'
          }} />
          {/* Hero Image */}
          <img 
            src="/cebe-hero.png" 
            alt="CeBe Hero" 
            style={{ 
              width: '500px',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
              position: 'relative',
              zIndex: 1
            }} 
          />
          {/* Text above rectangle */}
          <div style={{
            position: 'absolute',
            bottom: '65px',
            left: '30%',
            width: '151px',
            zIndex: 3,
            textAlign: 'center'
          }}>
            <span style={{
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 500,
              textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
              lineHeight: '1.4'
            }}>
              Hello Im Your Fav ChatBot !!!
            </span>
          </div>
          {/* Glass effect rectangle - left bottom overlapping hero */}
          <div style={{
            position: 'absolute',
            bottom: '43px',
            left: '30%',
            width: '151px',
            height: '86px',
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderTopLeftRadius: '30px',
            borderBottomLeftRadius: '30px',
            borderTopRightRadius: '0',
            borderBottomRightRadius: '0',
            zIndex: 2
          }} />
        </div>
      </div>
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
          bottom: '30px',
          right: '30px',
          zIndex: 10000,
          animation: 'slideUp 0.3s ease-out',
          pointerEvents: 'auto'
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
              zIndex: 1002,
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
          <EmbedWidget />
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

export default App;
