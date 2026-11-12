'use strict';
/**
 * PM2 — BenCalls (front)
 *
 *   npm run build                 gera o dist/
 *   npm run pm2:iniciar           sobe (ou: npx pm2 start ecosystem.config.cjs)
 *   npx pm2 logs bencalls-web
 *   npm run pm2:parar
 *
 * No Docker, o mesmo arquivo roda com pm2-runtime (em primeiro plano, repassando o
 * desligamento gracioso). Fora do Docker: `npx pm2 save` e `npx pm2 startup` para subir
 * junto com o servidor.
 */
const path = require('path');

// O .env da pasta vale também no pm2 (o que já estiver definido no terminal tem prioridade).
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch { /* sem .env: usa os padrões */ }

const LOGS = process.env.LOGS_DIR;
// Configurações do servidor repassadas do .env/terminal para os processos.
const REPASSAR = ['IPS_LIBERADOS', 'RESTRINGIR_IPS', 'CONFIAR_PROXY', 'TRUST_CLOUDFLARE', 'LIMITE_POR_MINUTO', 'LOG_ACESSO',
  'API_URL', 'BENHERMES_SEGREDO', 'BENHERMES_SEGREDO_ARQUIVO', 'DADOS_DIR', 'BENCALLS_VERSAO'];
const doAmbiente = Object.fromEntries(REPASSAR.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]]));

module.exports = {
  apps: [
    {
      name: 'bencalls-web',
      script: 'server/servidor.mjs',
      cwd: __dirname,
      // Modo cluster: várias cópias atendendo a mesma porta; se uma cair, as outras seguem.
      exec_mode: 'cluster',
      instances: Number(process.env.PM2_INSTANCIAS || 2),
      // Só considera no ar depois do process.send('ready') do servidor.
      wait_ready: true,
      listen_timeout: 10_000,
      kill_timeout: 8_000,
      shutdown_with_message: true,
      autorestart: true,
      exp_backoff_restart_delay: 1_000,
      max_restarts: 50,
      max_memory_restart: process.env.PM2_MEMORIA_MAX || '256M',
      time: true,
      merge_logs: true,
      ...(LOGS ? { out_file: path.join(LOGS, 'web.out.log'), error_file: path.join(LOGS, 'web.err.log') } : {}),
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || '8080',
        HOST: process.env.HOST || '0.0.0.0',
        ...doAmbiente
      }
    }
  ]
};
