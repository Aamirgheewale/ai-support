// Centralized API configuration for Widget
// Production fallback ensures the widget works even if VITE_API_BASE is not set during build

const PRODUCTION_API_URL = 'https://ai-support-api-production.up.railway.app';

export const API_BASE = import.meta.env.VITE_API_BASE || PRODUCTION_API_URL;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE || PRODUCTION_API_URL;

// Log configuration in development
if (import.meta.env.DEV) {
    console.log('🔧 Widget API Configuration:', {
        API_BASE,
        SOCKET_URL,
        usingFallback: !import.meta.env.VITE_API_BASE
    });
}
