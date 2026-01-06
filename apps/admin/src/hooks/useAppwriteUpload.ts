import { Client, Storage, ID } from 'appwrite';

const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || '';
const BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_ID || 'chat-attachments';

export function useAppwriteUpload() {
    const uploadAnnotatedImage = async (blob: Blob): Promise<string> => {
        if (!APPWRITE_PROJECT_ID) {
            console.error('❌ Appwrite Project ID is missing in environment variables');
            throw new Error('Appwrite Project ID is not configured in the admin panel.');
        }

        try {
            const client = new Client()
                .setEndpoint(APPWRITE_ENDPOINT)
                .setProject(APPWRITE_PROJECT_ID);

            const storage = new Storage(client);

            const file = new File([blob], `annotated_${Date.now()}.png`, { type: 'image/png' });

            const response = await storage.createFile(
                BUCKET_ID,
                ID.unique(),
                file
            );

            const fileUrl = storage.getFileView(BUCKET_ID, response.$id);
            return fileUrl.toString();
        } catch (error) {
            console.error('Error uploading annotated image to Appwrite:', error);
            throw new Error('Failed to upload annotated image. Please check your Appwrite configuration.');
        }
    };

    return { uploadAnnotatedImage };
}
