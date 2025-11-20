import React from 'react';
import EmbedWidget from './components/EmbedWidget';

function App() {
  return (
    <div style={{ padding: 20, background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ marginBottom: '8px', color: '#333' }}>AI Customer Support Chat System</h1>
        <p style={{ color: '#666', marginBottom: '24px' }}>AI-Based Customer Support Chat Assistant - Development Preview</p>
        <EmbedWidget />
      </div>
    </div>
  );
}

export default App;
