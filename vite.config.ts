import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: true,
    hmr: {
      clientPort: 443,
    },
    // @ts-ignore - allow e2b preview host
    allowedHosts: true as any,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  base: './',
  build: {
    outDir: 'dist',
  }
})
