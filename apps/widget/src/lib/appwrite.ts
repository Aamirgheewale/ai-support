import { Client, Storage } from 'appwrite';

/**
 * Appwrite Storage Configuration
 * 
 * CRITICAL: Both VITE_APPWRITE_PROJECT_ID and VITE_APPWRITE_BUCKET_ID are REQUIRED.
 * 
 * Why bucket IDs must not have defaults:
 * - Using a fallback bucket ID (e.g., 'chat-attachments') can cause silent failures
 * - If the bucket doesn't exist, uploads will return 404 errors without clear indication
 * - Misconfigured bucket IDs lead to files being uploaded to wrong buckets or failing silently
 * - Strict validation ensures the widget fails fast with clear error messages
 * - This prevents production issues where files appear to upload but are actually lost
 */

// Appwrite endpoint - always use cloud.appwrite.io (consistent CORS configuration)
const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';

// Read required environment variables (NO FALLBACKS)
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const APPWRITE_BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_ID;

// TEMPORARY: Log Appwrite configuration in development mode for verification
if (import.meta.env.DEV) {
  console.log('🔍 [TEMPORARY] Appwrite Configuration:', {
    VITE_APPWRITE_PROJECT_ID: APPWRITE_PROJECT_ID || 'MISSING',
    VITE_APPWRITE_BUCKET_ID: APPWRITE_BUCKET_ID || 'MISSING',
    endpoint: APPWRITE_ENDPOINT
  });
}

/**
 * Strict validation: Fail fast if required configuration is missing
 * 
 * Both PROJECT_ID and BUCKET_ID are required:
 * - PROJECT_ID: Required for CORS headers and API authentication
 * - BUCKET_ID: Required to prevent 404 errors from uploading to non-existent buckets
 * 
 * Note: The Vite build plugin will catch this at build time,
 * but we also check here for runtime safety.
 */
if (!APPWRITE_PROJECT_ID) {
  const errorMessage = 
    'VITE_APPWRITE_PROJECT_ID is missing. Appwrite uploads will fail due to CORS. ' +
    'Please set this environment variable in your deployment platform.';
  console.error('❌ Appwrite Configuration Error:', errorMessage);
  throw new Error(errorMessage);
}

if (!APPWRITE_BUCKET_ID) {
  const errorMessage = 
    'VITE_APPWRITE_BUCKET_ID is missing. File uploads will fail with 404 errors. ' +
    'Please set this environment variable to your Appwrite Storage bucket ID. ' +
    'Do not use fallback values - they can cause silent failures.';
  console.error('❌ Appwrite Configuration Error:', errorMessage);
  throw new Error(errorMessage);
}

// Validated bucket ID constant (exported for use in upload code)
export const BUCKET_ID: string = APPWRITE_BUCKET_ID;

/**
 * Initialize Appwrite Client (Singleton Pattern)
 * 
 * The client is initialized exactly once and reused across all upload operations.
 * Initialization order is critical:
 * 1. setEndpoint() - Sets the Appwrite API endpoint
 * 2. setProject() - Sets the project ID (REQUIRED for CORS headers)
 * 3. new Storage() - Creates storage instance AFTER client is fully configured
 * 
 * This ensures proper CORS headers are included in all requests.
 */
let appwriteClient: Client | null = null;
let appwriteStorage: Storage | null = null;

/**
 * Get or create the Appwrite client instance (singleton)
 * 
 * Client is initialized with:
 * - Endpoint: https://cloud.appwrite.io/v1 (hardcoded for consistency)
 * - Project ID: VITE_APPWRITE_PROJECT_ID (from environment)
 * 
 * @throws {Error} If VITE_APPWRITE_PROJECT_ID is missing (should never happen after validation)
 */
function getAppwriteClient(): Client {
  // This check is redundant after module-level validation, but provides extra safety
  if (!APPWRITE_PROJECT_ID) {
    throw new Error('VITE_APPWRITE_PROJECT_ID is missing. Appwrite uploads will fail due to CORS.');
  }

  if (!appwriteClient) {
    appwriteClient = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID);
  }

  return appwriteClient;
}

/**
 * Get or create the Appwrite Storage instance (singleton)
 * 
 * Storage is created AFTER the client is fully initialized.
 * This ensures the client has proper CORS configuration before storage operations.
 * 
 * @returns {Storage} Singleton Storage instance
 */
export function getAppwriteStorage(): Storage {
  if (!appwriteStorage) {
    const client = getAppwriteClient();
    appwriteStorage = new Storage(client);
  }

  return appwriteStorage;
}

/**
 * Check if Appwrite is properly configured
 * 
 * @returns {boolean} True if both PROJECT_ID and BUCKET_ID are set
 */
export function isAppwriteConfigured(): boolean {
  return !!(APPWRITE_PROJECT_ID && APPWRITE_BUCKET_ID);
}

/**
 * Get Appwrite configuration for debugging
 * 
 * @returns {object} Configuration object with endpoint, projectId, bucketId, and isConfigured status
 */
export function getAppwriteConfig() {
  return {
    endpoint: APPWRITE_ENDPOINT,
    projectId: APPWRITE_PROJECT_ID || 'MISSING',
    bucketId: APPWRITE_BUCKET_ID || 'MISSING',
    isConfigured: isAppwriteConfigured(),
  };
}
