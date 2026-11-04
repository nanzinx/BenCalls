import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  build: {
    // Fontes sempre como arquivo (nunca data:), para o CSP ficar em font-src 'self'.
    assetsInlineLimit: (arquivo) => (/\.(woff2?|ttf)$/.test(arquivo) ? false : undefined),
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: { charts: ['recharts'], vendor: ['react', 'react-dom', 'react-router-dom'] }
      }
    }
  }
});
