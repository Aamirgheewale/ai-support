import { Client, Storage, ID } from 'appwrite';

const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || '';
const BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_ID || 'chat-attachments';

export function useAttachmentUpload() {
    const uploadFile = async (file: File): Promise<string> => {
        try {
            // Initialize Appwrite client
            const client = new Client()
                .setEndpoint(APPWRITE_ENDPOINT)
                .setProject(APPWRITE_PROJECT_ID);

            const storage = new Storage(client);

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
            console.error('Error uploading file to Appwrite:', error);
            throw new Error('Failed to upload file. Please try again.');
        }
    };

    return { uploadFile };
}
