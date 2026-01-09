import { ID } from 'appwrite';
import { getAppwriteStorage, BUCKET_ID, isAppwriteConfigured } from '../lib/appwrite';

/**
 * Hook for uploading file attachments to Appwrite Storage
 * 
 * Uses the shared Appwrite client from lib/appwrite.ts to ensure:
 * - Single client instance (no re-initialization)
 * - Proper CORS headers (project ID configured)
 * - Validated bucket ID (no fallbacks to prevent 404 errors)
 * - Consistent error handling
 */
export function useAttachmentUpload() {
    const uploadFile = async (file: File): Promise<string> => {
        // Check configuration before attempting upload
        if (!isAppwriteConfigured()) {
            const errorMessage = 
                'Appwrite is not configured. Both VITE_APPWRITE_PROJECT_ID and VITE_APPWRITE_BUCKET_ID are required. ' +
                'File uploads are disabled.';
            console.error('❌', errorMessage);
            throw new Error(errorMessage);
        }

        try {
            // Get the shared Storage instance (client is already initialized)
            const storage = getAppwriteStorage();
            
            // Use the validated BUCKET_ID constant (no fallbacks)
            // This ensures we never upload to a non-existent bucket

            // Upload file to Appwrite storage
            const response = await storage.createFile(
                BUCKET_ID,
                ID.unique(),
                file
            );

            // Get the file view URL
            const fileUrl = storage.getFileView(BUCKET_ID, response.$id);

            // Return the full URL as string
            return fileUrl.toString();
        } catch (error) {
            console.error('❌ Error uploading file to Appwrite:', error);
            
            // Provide more specific error messages
            if (error instanceof Error) {
                // Check for configuration errors
                if (error.message.includes('CORS') || error.message.includes('project')) {
                    throw new Error('Appwrite configuration error. Please check VITE_APPWRITE_PROJECT_ID.');
                }
                // Check for bucket-related errors (404, not found, etc.)
                if (error.message.includes('404') || error.message.includes('not found') || error.message.includes('bucket')) {
                    throw new Error(
                        'Appwrite bucket error. Please verify that VITE_APPWRITE_BUCKET_ID matches an existing bucket in your Appwrite project.'
                    );
                }
                throw error;
            }
            
            throw new Error('Failed to upload file. Please try again.');
        }
    };

    return { uploadFile };
}
