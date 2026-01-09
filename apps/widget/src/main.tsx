import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// TEMPORARY: Log Appwrite project ID for production verification
console.log('🔍 [TEMPORARY] VITE_APPWRITE_PROJECT_ID:', import.meta.env.VITE_APPWRITE_PROJECT_ID || 'MISSING');

const rootElement = document.getElementById('root')
if (!rootElement) {
  console.error('Root element not found! Make sure there is a <div id="root"></div> in your HTML.')
} else {
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    console.log('✅ Widget app initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize widget app:', error)
  }
}
