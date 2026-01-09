import { ID } from 'appwrite';
import { getAppwriteStorage, getBucketId, isAppwriteConfigured } from '../lib/appwrite';

/**
 * Hook for uploading file attachments to Appwrite Storage
 * 
 * Uses the shared Appwrite client from lib/appwrite.ts to ensure:
 * - Single client instance (no re-initialization)
 * - Proper CORS headers (project ID configured)
 * - Consistent error handling
 */
export function useAttachmentUpload() {
    const uploadFile = async (file: File): Promise<string> => {
        // Check configuration before attempting upload
        if (!isAppwriteConfigured()) {
            const errorMessage = 'Appwrite is not configured. VITE_APPWRITE_PROJECT_ID is missing. File uploads are disabled.';
            console.error('❌', errorMessage);
            throw new Error(errorMessage);
        }

        try {
            // Get the shared Storage instance (client is already initialized)
            const storage = getAppwriteStorage();
            const bucketId = getBucketId();

            // Upload file to Appwrite storage
            const response = await storage.createFile(
                bucketId,
                ID.unique(),
                file
            );

            // Get the file view URL
            const fileUrl = storage.getFileView(bucketId, response.$id);

            // Return the full URL as string
            return fileUrl.toString();
        } catch (error) {
            console.error('❌ Error uploading file to Appwrite:', error);
            
            // Provide more specific error messages
            if (error instanceof Error) {
                if (error.message.includes('CORS') || error.message.includes('project')) {
                    throw new Error('Appwrite configuration error. Please check VITE_APPWRITE_PROJECT_ID.');
                }
                throw error;
            }
            
            throw new Error('Failed to upload file. Please try again.');
        }
    };

    return { uploadFile };
}
