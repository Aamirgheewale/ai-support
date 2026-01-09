import { Client, Storage } from 'appwrite';

/**
 * Appwrite Storage Configuration
 *
 * CRITICAL:
 * - VITE_APPWRITE_PROJECT_ID and VITE_APPWRITE_BUCKET_ID MUST be provided at runtime
 * - Bucket IDs must NEVER have fallback values
 *
 * Why no fallbacks:
 * - Wrong bucket IDs cause silent 404 upload failures
 * - Files may appear to upload but are never stored
 * - Strict validation prevents production data loss
 */

// Appwrite endpoint (fixed for consistent CORS behavior)
const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';

// Runtime environment variables (NO FALLBACKS)
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const APPWRITE_BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_ID;

// Development-only visibility (safe)
if (import.meta.env.DEV) {
  console.log('[Appwrite] Runtime config:', {
    projectId: APPWRITE_PROJECT_ID ?? 'MISSING',
    bucketId: APPWRITE_BUCKET_ID ?? 'MISSING',
    endpoint: APPWRITE_ENDPOINT,
  });
}

// Export bucket ID for upload usage
export const BUCKET_ID = APPWRITE_BUCKET_ID;

// Singleton instances
let appwriteClient: Client | null = null;
let appwriteStorage: Storage | null = null;

/**
 * Validate Appwrite runtime configuration
 * This is intentionally executed lazily (not at module load)
 */
function validateAppwriteConfig(): void {
  if (!APPWRITE_PROJECT_ID) {
    throw new Error(
      '[Appwrite] VITE_APPWRITE_PROJECT_ID is missing. ' +
      'Uploads are disabled. Check Railway → Widget → Variables.'
    );
  }

  if (!APPWRITE_BUCKET_ID) {
    throw new Error(
      '[Appwrite] VITE_APPWRITE_BUCKET_ID is missing. ' +
      'Uploads are disabled to prevent 404 errors.'
    );
  }
}

/**
 * Get Appwrite client (singleton)
 */
function getAppwriteClient(): Client {
  validateAppwriteConfig();

  if (!appwriteClient) {
    appwriteClient = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID!);
  }

  return appwriteClient;
}

/**
 * Get Appwrite Storage instance (singleton)
 */
export function getAppwriteStorage(): Storage {
  validateAppwriteConfig();

  if (!appwriteStorage) {
    const client = getAppwriteClient();
    appwriteStorage = new Storage(client);
  }

  return appwriteStorage;
}

/**
 * Non-throwing helper for UI checks
 */
export function isAppwriteConfigured(): boolean {
  return Boolean(APPWRITE_PROJECT_ID && APPWRITE_BUCKET_ID);
}

/**
 * Debug helper
 */
export function getAppwriteConfig() {
  return {
    endpoint: APPWRITE_ENDPOINT,
    projectId: APPWRITE_PROJECT_ID ?? 'MISSING',
    bucketId: APPWRITE_BUCKET_ID ?? 'MISSING',
    isConfigured: isAppwriteConfigured(),
  };
}
