import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { carregarRegras, middlewareBloqueio } from './server/bloqueio.mjs';
import { criarIntegracao } from './server/integracao/rotas.mjs';

/** Os mesmos bloqueios de IP do servidor de produção, em `npm run dev` e `npm run preview`. */
function bloqueioIp() {
  // Não retorna nada: se configureServer devolver uma função, o Vite a trata como gancho posterior.
  const usar = (server) => {
    server.middlewares.use(middlewareBloqueio(carregarRegras()));
  };
  return { name: 'bencalls-bloqueio-ip', configureServer: usar, configurePreviewServer: usar };
}

/** A API de integração com o BenHermes também em `npm run dev` (ligue com BENHERMES_SEGREDO). */
function integracaoBenHermes() {
  const usar = (server) => {
    const integracao = criarIntegracao();
    server.middlewares.use((req, res, next) => {
      const r = integracao.atender(req, res);
      if (!r) return next();
      r.catch(next);
    });
  };
  return { name: 'bencalls-integracao-benhermes', configureServer: usar, configurePreviewServer: usar };
}

export default defineConfig({
  plugins: [react(), bloqueioIp(), integracaoBenHermes()],
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
