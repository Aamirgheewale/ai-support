import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite plugin to validate Appwrite environment variables at build time
 * This ensures the build fails fast if required configuration is missing
 * 
 * Both PROJECT_ID and BUCKET_ID are required - no fallbacks allowed.
 * Fallback bucket IDs can cause silent 404 errors in production.
 */
function validateAppwriteConfig(): Plugin {
  return {
    name: 'validate-appwrite-config',
    buildStart() {
      const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
      const bucketId = process.env.VITE_APPWRITE_BUCKET_ID;
      
      // Validate PROJECT_ID
      if (!projectId) {
        const error = new Error(
          '❌ Build Error: VITE_APPWRITE_PROJECT_ID is missing.\n' +
          'Appwrite file uploads require this environment variable to be set.\n' +
          'Please set VITE_APPWRITE_PROJECT_ID in your environment or .env file.\n' +
          'Without it, file uploads will fail due to CORS errors.'
        );
        this.error(error);
        return;
      }
      
      // Validate BUCKET_ID (no fallbacks - prevents 404 errors)
      if (!bucketId) {
        const error = new Error(
          '❌ Build Error: VITE_APPWRITE_BUCKET_ID is missing.\n' +
          'Appwrite file uploads require this environment variable to be set.\n' +
          'Please set VITE_APPWRITE_BUCKET_ID in your environment or .env file.\n' +
          'Do not use fallback values - they can cause silent failures and 404 errors.\n' +
          'The bucket ID must match an existing bucket in your Appwrite project.'
        );
        this.error(error);
        return;
      }
      
      console.log('✅ Appwrite configuration validated:', {
        endpoint: 'https://cloud.appwrite.io/v1',
        projectId: projectId.substring(0, 8) + '...', // Show first 8 chars for verification
        bucketId: bucketId
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

