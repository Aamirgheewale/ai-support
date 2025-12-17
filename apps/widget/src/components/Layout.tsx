import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import EmbedWidget from './EmbedWidget';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [servicesOpen, setServicesOpen] = useState(false);
  const servicesRef = useRef<HTMLDivElement>(null);
  const [chatWidgetOpen, setChatWidgetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 640);
  const location = useLocation();

  // Handle mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const chatButton = (event.target as HTMLElement)?.closest('[aria-label="Open chat"]');
      const chatWidget = (event.target as HTMLElement)?.closest('[data-chat-widget]');
      if (chatButton || chatWidget) {
        return;
      }
      
      if (servicesRef.current && !servicesRef.current.contains(target)) {
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

  // Close services dropdown when route changes
  useEffect(() => {
    setServicesOpen(false);
  }, [location.pathname]);

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
        justifyContent: isMobile ? 'center' : 'space-between',
        alignItems: 'center',
        padding: isMobile ? '12px 8px' : '24px 0',
        zIndex: 100,
        gap: isMobile ? '8px' : '20px',
        overflow: 'visible',
        pointerEvents: 'auto',
        background: 'transparent',
        flexWrap: isMobile ? 'wrap' : 'nowrap'
      }}>
        {/* Wreath backgrounds */}
        {!isMobile && (
          <>
            <div style={{
              position: 'absolute',
              top: '0',
              left: '0',
              width: '250px',
              height: 'auto',
              zIndex: 0,
              pointerEvents: 'none'
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
                  transform: 'rotate(180deg)'
                }} 
              />
            </div>
            <div style={{
              position: 'absolute',
              top: '0',
              right: '0',
              width: '250px',
              height: 'auto',
              zIndex: 0,
              pointerEvents: 'none'
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
                  transform: 'rotate(145deg)'
                }} 
              />
            </div>
          </>
        )}

        {/* Left Rectangle - ChatBot */}
        {!isMobile && (
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
        )}

        {/* Center - CeBe Heading */}
        <div style={{ 
          flex: isMobile ? '1 1 100%' : 1, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
          order: isMobile ? -1 : 0,
          width: isMobile ? '100%' : 'auto'
        }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <div style={{
              position: 'relative',
              display: 'inline-block',
              padding: isMobile ? '8px 16px' : '16px 32px'
            }}>
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
              <h1 style={{ 
                color: '#ffffff', 
                fontSize: isMobile ? '28px' : '48px',
                fontWeight: 400,
                fontFamily: "'Bungee Shade', cursive",
                margin: 0,
                letterSpacing: isMobile ? '1px' : '2px',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)',
                textTransform: 'uppercase',
                position: 'relative',
                zIndex: 1
              }}>
                CeBe
              </h1>
            </div>
          </Link>
        </div>

        {/* Right Rectangle - Home, Services, Logo */}
        {!isMobile && (
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
            <Link 
              to="/" 
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
            </Link>
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
                  <Link 
                    to="/service1" 
                    onClick={() => setServicesOpen(false)}
                    style={{ display: 'block', padding: '8px 16px', color: '#ffffff', textDecoration: 'none', fontSize: '14px' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    Service 1
                  </Link>
                  <Link 
                    to="/service2" 
                    onClick={() => setServicesOpen(false)}
                    style={{ display: 'block', padding: '8px 16px', color: '#ffffff', textDecoration: 'none', fontSize: '14px' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    Service 2
                  </Link>
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
        )}
      </div>

      {/* Page Content */}
      {children}

      {/* Floating Chat Button - Circular */}
      {!chatWidgetOpen && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('💬 Chat button clicked, opening widget...');
            setChatWidgetOpen(true);
          }}
          style={{
            position: 'fixed',
            bottom: isMobile ? '20px' : '20px',
            right: isMobile ? '20px' : '20px',
            width: isMobile ? '60px' : '70px',
            height: isMobile ? '60px' : '70px',
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
            fontSize: isMobile ? '20px' : '24px',
            fontWeight: 'bold',
            pointerEvents: 'auto'
          }}
          onMouseEnter={(e) => {
            if (!isMobile) {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 6px 25px rgba(0, 0, 0, 0.4), 0 0 30px rgba(255, 255, 255, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isMobile) {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 20px rgba(255, 255, 255, 0.1)';
            }
          }}
          aria-label="Open chat"
        >
          💬
        </button>
      )}

      {/* Chat Widget Popup */}
      {chatWidgetOpen && (
        <div 
          data-chat-widget="true"
          style={{
            position: 'fixed',
            // Desktop: standard compact widget bottom-right
            // Mobile: full-width at bottom
            top: isMobile ? 'auto' : 'auto',
            left: isMobile ? 0 : 'auto',
            right: isMobile ? 0 : 20,
            bottom: isMobile ? 0 : 20,
            width: isMobile ? '100%' : 360,
            height: isMobile ? '100vh' : 'auto', // inner widget capped to 520px
            zIndex: 10001,
            animation: 'slideUp 0.3s ease-out',
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end'
          }}
        >
          <EmbedWidget onClose={() => setChatWidgetOpen(false)} />
        </div>
      )}

      {/* CSS animation */}
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

