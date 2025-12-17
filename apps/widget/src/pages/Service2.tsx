import { useEffect } from 'react';

export default function Service2() {
  useEffect(() => {
    document.title = 'Service 2 - CeBe';
  }, []);

  return (
    <div style={{ 
      maxWidth: 1200, 
      margin: '0 auto', 
      marginTop: '100px',
      padding: '40px 20px',
      color: '#ffffff'
    }}>
      <h1 style={{ 
        fontSize: '48px', 
        fontWeight: 600, 
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        Service 2
      </h1>
      <p style={{ 
        fontSize: '18px', 
        lineHeight: '1.6',
        textAlign: 'center',
        maxWidth: '800px',
        margin: '0 auto',
        opacity: 0.9
      }}>
        Welcome to Service 2. This is a dedicated page for our second service offering. 
        You can use the chat widget to get assistance or ask questions about this service.
      </p>
    </div>
  );
}

