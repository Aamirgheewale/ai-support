import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
