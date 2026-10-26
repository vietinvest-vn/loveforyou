import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(() => ({
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['love-icon.svg', 'love-icon-180.png', 'love-icon-192.png', 'love-icon-512.png'],
      manifest: {
        id: '/',
        name: 'LoveForYou',
        short_name: 'LoveForYou',
        description: 'Một góc riêng để hai bạn cất giữ những điều thương.',
        lang: 'vi',
        orientation: 'portrait',
        theme_color: '#fff7fa',
        background_color: '#fff7fa',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/love-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/love-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/love-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
}))
