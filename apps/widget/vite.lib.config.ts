import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite plugin to validate Appwrite environment variables at build time
 * This ensures the build fails fast if required configuration is missing
 */
function validateAppwriteConfig(): Plugin {
  return {
    name: 'validate-appwrite-config',
    buildStart() {
      const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
      
      if (!projectId) {
        const error = new Error(
          '❌ Build Error: VITE_APPWRITE_PROJECT_ID is missing.\n' +
          'Appwrite file uploads require this environment variable to be set.\n' +
          'Please set VITE_APPWRITE_PROJECT_ID in your environment or .env file.\n' +
          'Without it, file uploads will fail due to CORS errors.'
        );
        this.error(error);
      }
      
      console.log('✅ Appwrite configuration validated:', {
        endpoint: process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
        projectId: projectId.substring(0, 8) + '...', // Show first 8 chars for verification
        bucketId: process.env.VITE_APPWRITE_BUCKET_ID || 'chat-attachments'
      });
    }
  };
}

// Configuration for building the embeddable widget library
export default defineConfig({
  plugins: [react(), validateAppwriteConfig()],
  define: {
    'process.env': {}
  },
  build: {
    lib: {
      entry: 'src/embed-entry.tsx',
      name: 'AiSupportWidget',
      fileName: 'ai-support-widget',
      formats: ['umd', 'es']
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    },
    // Copy public files (including index.html) to dist
    copyPublicDir: true
  }
})

