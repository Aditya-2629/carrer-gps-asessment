import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Heavy vector PDF rendering engine loaded async on click only
            if (
              id.includes('@react-pdf') ||
              id.includes('pdfkit') ||
              id.includes('fontkit') ||
              id.includes('png-js') ||
              id.includes('restructure')
            ) {
              return 'pdf-vendor'
            }
            // Motion, GSAP, Mascot animations
            if (
              id.includes('framer-motion') ||
              id.includes('gsap') ||
              id.includes('wobnimo')
            ) {
              return 'motion-vendor'
            }
            // Charts & Data Viz
            if (
              id.includes('recharts') ||
              id.includes('d3-') ||
              id.includes('victory')
            ) {
              return 'charts-vendor'
            }
            // Core Framework
            if (
              id.includes('react') ||
              id.includes('react-dom') ||
              id.includes('zustand') ||
              id.includes('@tanstack')
            ) {
              return 'react-vendor'
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 1400,
  },
})
