// Centralized API configuration
// Production fallback ensures the app works even if VITE_API_BASE is not set during build

const PRODUCTION_API_URL = 'https://api-production-a3a5.up.railway.app';

export const API_BASE = import.meta.env.VITE_API_BASE || PRODUCTION_API_URL;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE || PRODUCTION_API_URL;
export const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'dev-secret-change-me';

// Log configuration in development
if (import.meta.env.DEV) {
    console.log('🔧 API Configuration:', {
        API_BASE,
        SOCKET_URL,
        usingFallback: !import.meta.env.VITE_API_BASE
    });
}
