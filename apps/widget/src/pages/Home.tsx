import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    document.title = 'CeBe - Home';
  }, []);

  return (
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
  );
}

