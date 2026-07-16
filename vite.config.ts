import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Para evitar incompatibilidades entre versões do Vite e do vite-plugin-pwa,
// o PWA fica DESABILITADO por padrão no build.
// Para habilitar, rode com:
//   VITE_ENABLE_PWA=true npm run build
const enablePwa = process.env.VITE_ENABLE_PWA === 'true';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    enablePwa
      ? VitePWA({
          registerType: 'autoUpdate',
          includeAssets: [
            'OptmaMenuLogo.ico',
            'apple-touch-icon.png',
            'favicon-16x16.png',
            'favicon-32x32.png',
          ],
          manifest: {
            name: 'OptmaMenu',
            short_name: 'OptmaMenu',
            description: 'OptmaMenu | Solução em Cardápio Digital',
            theme_color: '#21A896',
            background_color: '#ffffff',
            display: 'standalone',
            scope: '/',
            start_url: '/',
            orientation: 'portrait',
            icons: [
              { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
              { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
              {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable',
              },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
          },
        })
      : undefined,
  ].filter(Boolean),
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            return 'vendor';
          }
        },
      },
    },
  },
});
