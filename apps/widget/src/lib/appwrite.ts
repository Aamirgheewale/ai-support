import { Client, Storage } from 'appwrite';

/**
 * Appwrite Configuration
 * 
 * These environment variables must be set for file uploads to work:
 * - VITE_APPWRITE_ENDPOINT: Appwrite API endpoint (defaults to cloud.appwrite.io)
 * - VITE_APPWRITE_PROJECT_ID: Appwrite project ID (REQUIRED - no default)
 * - VITE_APPWRITE_BUCKET_ID: Storage bucket ID (defaults to 'chat-attachments')
 */

const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_ID || 'chat-attachments';

// TEMPORARY: Log Appwrite project ID for production verification
console.log('🔍 [TEMPORARY] Appwrite Config - VITE_APPWRITE_PROJECT_ID:', APPWRITE_PROJECT_ID || 'MISSING');

/**
 * Defensive check: Fail fast if project ID is missing
 * This prevents CORS errors and provides clear error messages
 * 
 * Note: The Vite build plugin will catch this at build time,
 * but we also check here for runtime safety.
 */
if (!APPWRITE_PROJECT_ID) {
  const errorMessage = 'VITE_APPWRITE_PROJECT_ID is missing. Appwrite uploads will fail due to CORS. Please set this environment variable.';
  console.error('❌ Appwrite Configuration Error:', errorMessage);
  
  // Always throw - the build plugin should catch this, but runtime check is a safety net
  // In production builds, this code should never execute if the build plugin worked correctly
  throw new Error(errorMessage);
}

/**
 * Initialize Appwrite Client
 * 
 * This client is initialized once and reused across all upload operations.
 * It must be configured with:
 * 1. Endpoint (setEndpoint)
 * 2. Project ID (setProject) - REQUIRED for CORS headers
 * 
 * The Storage instance is created AFTER the client is fully configured.
 */
let appwriteClient: Client | null = null;
let appwriteStorage: Storage | null = null;

/**
 * Get or create the Appwrite client instance
 * 
 * @throws {Error} If VITE_APPWRITE_PROJECT_ID is missing
 */
function getAppwriteClient(): Client {
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
 * Get or create the Appwrite Storage instance
 * 
 * Storage is created AFTER the client is fully initialized.
 * 
 * @throws {Error} If VITE_APPWRITE_PROJECT_ID is missing
 */
export function getAppwriteStorage(): Storage {
  if (!appwriteStorage) {
    const client = getAppwriteClient();
    appwriteStorage = new Storage(client);
  }

  return appwriteStorage;
}

/**
 * Get the configured bucket ID
 */
export function getBucketId(): string {
  return BUCKET_ID;
}

/**
 * Check if Appwrite is properly configured
 */
export function isAppwriteConfigured(): boolean {
  return !!APPWRITE_PROJECT_ID;
}

/**
 * Get Appwrite configuration for debugging
 */
export function getAppwriteConfig() {
  return {
    endpoint: APPWRITE_ENDPOINT,
    projectId: APPWRITE_PROJECT_ID || 'MISSING',
    bucketId: BUCKET_ID,
    isConfigured: isAppwriteConfigured(),
  };
}
