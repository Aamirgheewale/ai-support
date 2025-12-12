import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// This config builds the full ChatBot website (App.tsx)
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {}
  },
  base: '/'
})
