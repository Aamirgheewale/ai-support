// import { defineConfig, Plugin } from 'vite'
// import react from '@vitejs/plugin-react'

// /**
//  * Vite plugin to validate Appwrite environment variables at build time
//  * This ensures the build fails fast if required configuration is missing
//  */
// function validateAppwriteConfig(): Plugin {
//   return {
//     name: 'validate-appwrite-config',
//     buildStart() {
//       const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
      
//       if (!projectId) {
//         const error = new Error(
//           '❌ Build Error: VITE_APPWRITE_PROJECT_ID is missing.\n' +
//           'Appwrite file uploads require this environment variable to be set.\n' +
//           'Please set VITE_APPWRITE_PROJECT_ID in your environment or .env file.\n' +
//           'Without it, file uploads will fail due to CORS errors.'
//         );
//         this.error(error);
//       }
      
//       console.log('✅ Appwrite configuration validated:', {
//         endpoint: process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
//         projectId: projectId.substring(0, 8) + '...', // Show first 8 chars for verification
//         bucketId: process.env.VITE_APPWRITE_BUCKET_ID || 'chat-attachments'
//       });
//     }
//   };
// }

// // https://vite.dev/config/
// // This config builds the full ChatBot website (App.tsx)
// export default defineConfig({
//   plugins: [react(), validateAppwriteConfig()],
//   define: {
//     'process.env': {}
//   },
//   base: '/'
// })

import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite plugin to validate Appwrite environment variables at build time.
 * This ensures the build fails fast if required configuration is missing.
 * 
 * Both PROJECT_ID and BUCKET_ID are required - no fallbacks allowed.
 * Fallback bucket IDs can cause silent 404 errors in production.
 */
function validateAppwriteConfig(): Plugin {
  return {
    name: 'validate-appwrite-config',
    buildStart() {
      const rawProjectId = process.env.VITE_APPWRITE_PROJECT_ID
      const rawBucketId = process.env.VITE_APPWRITE_BUCKET_ID

      // Validate PROJECT_ID
      if (!rawProjectId) {
        this.error(
          '❌ Build Error: VITE_APPWRITE_PROJECT_ID is missing.\n' +
          'Appwrite file uploads require this environment variable to be set.\n' +
          'Please set VITE_APPWRITE_PROJECT_ID in Railway → Widget Service → Variables.\n' +
          'Without it, file uploads will fail due to CORS errors.'
        )
        return
      }

      // Validate BUCKET_ID (no fallbacks - prevents 404 errors)
      if (!rawBucketId) {
        this.error(
          '❌ Build Error: VITE_APPWRITE_BUCKET_ID is missing.\n' +
          'Appwrite file uploads require this environment variable to be set.\n' +
          'Please set VITE_APPWRITE_BUCKET_ID in Railway → Widget Service → Variables.\n' +
          'Do not use fallback values - they can cause silent failures and 404 errors.\n' +
          'The bucket ID must match an existing bucket in your Appwrite project.'
        )
        return
      }

      // ✅ TypeScript now KNOWS these are strings
      const projectId: string = rawProjectId
      const bucketId: string = rawBucketId

      console.log('✅ Appwrite configuration validated:', {
        endpoint: 'https://cloud.appwrite.io/v1',
        projectId: projectId.slice(0, 8) + '...',
        bucketId: bucketId,
      })
    },
  }
}

// https://vite.dev/config/
// This config builds the full ChatBot website (App.tsx)
export default defineConfig({
  plugins: [
    react(),
    validateAppwriteConfig(),
  ],
  base: '/',
})
