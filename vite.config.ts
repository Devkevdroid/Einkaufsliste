import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installierbare App + Service Worker: Die App-Hülle kommt offline aus dem Cache.
    // Daten laufen weiter über Supabase; die Einkaufsliste hat ihren eigenen Offline-Speicher.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Einkaufsliste',
        short_name: 'Einkauf',
        description: 'Wochenplan und gemeinsame Einkaufsliste',
        lang: 'de',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#047857',
        background_color: '#fafaf9',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Lange auf das App-Icon drücken → direkt zur Liste oder zum Plan.
        shortcuts: [
          { name: 'Einkaufsliste', url: '/einkauf', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Wochenplan', url: '/woche', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Alle App-Adressen (/woche, /einkauf, …) offline mit index.html beantworten.
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Rezeptbilder von HelloFresh: aus dem Cache, den src/lib/recipeStore.ts für alle Rezepte füllt.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname === 'img.hellofresh.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'rezeptbilder',
              // HelloFresh antwortet mit „Vary: Accept“; <img> schickt einen anderen Accept-Header als fetch().
              matchOptions: { ignoreVary: true },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
})
