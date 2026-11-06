// Servidor de produção do BenCalls (front). Sem dependências: só o Node.
//
// Por que um servidor próprio e não "vite preview"/serve: controle total dos cabeçalhos de
// segurança (CSP, HSTS…), cache certo para os arquivos com hash, compressão e um /healthz para
// o Docker e o pm2. Pensado para ficar atrás do Cloudflare Tunnel (sem porta aberta na internet).
//
// Endurecimento:
//  - os arquivos do build são carregados na memória na subida; só o que está nessa lista é
//    servido, então não existe caminho para "../" ou para ler outro arquivo do disco;
//  - só GET e HEAD; URL longa demais vira 414; limite de requisições por IP (429);
//  - tempos de requisição e de cabeçalho curtos (protege contra conexões lentas);
//  - desligamento gracioso (SIGTERM/SIGINT e a mensagem "shutdown" do pm2).
//
// Variáveis: PORT (8080), HOST (0.0.0.0), DIST_DIR (../dist), API_URL (origem extra liberada no
// connect-src do CSP), TRUST_CLOUDFLARE=1 (usa CF-Connecting-IP como IP do cliente),
// LIMITE_POR_MINUTO (600), LOG_ACESSO (1), IPS_LIBERADOS (soma IPs aos de ips-liberados.txt; só eles
// entram), RESTRINGIR_IPS=0 (desliga a restrição, só para teste local),
// BENHERMES_SEGREDO ou BENHERMES_SEGREDO_ARQUIVO (liga a API de integração com o BenHermes) e
// DADOS_DIR (pasta gravável para os eventos recebidos; veja docs/API-INTEGRACAO.md).
import http from 'node:http';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync, brotliCompressSync, constants as zc } from 'node:zlib';
import { carregarRegras, resumoDoFiltro } from './acesso-ip.mjs';
import { criarIntegracao } from './integracao/rotas.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const DIST = resolve(process.env.DIST_DIR || join(AQUI, '..', 'dist'));
const API_URL = (process.env.API_URL || '').trim();
const TRUST_CF = process.env.TRUST_CLOUDFLARE === '1';
const LIMITE = Number(process.env.LIMITE_POR_MINUTO || 600);
const LOG = process.env.LOG_ACESSO !== '0';
const VERSAO = process.env.BENCALLS_VERSAO || 'dev';
const INICIO = Date.now();

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};
const COMPRIMIR = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.webmanifest']);

// ---------------------------------------------------------------- cabeçalhos de segurança
const connect = ["'self'", API_URL].filter(Boolean).join(' ');
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // React aplica estilos via propriedade (CSSOM) e o Recharts usa atributos de estilo.
  "style-src 'self' 'unsafe-inline'",
  // data:/blob: para o logo e a imagem de login que a empresa envia na personalização.
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src ${connect}`,
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  'upgrade-insecure-requests'
].join('; ');

export const SEGURANCA = {
  'Content-Security-Policy': CSP,
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Origin-Agent-Cluster': '?1',
  'X-DNS-Prefetch-Control': 'off',
  'X-Permitted-Cross-Domain-Policies': 'none'
};

// ---------------------------------------------------------------- arquivos na memória
function listar(dir) {
  const out = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...listar(p));
    else if (s.isFile()) out.push(p);
  }
  return out;
}

export function carregar(dist = DIST) {
  const mapa = new Map();
  for (const arq of listar(dist)) {
    const rota = '/' + relative(dist, arq).split('\\').join('/');
    const ext = extname(arq).toLowerCase();
    const corpo = readFileSync(arq);
    const etag = '"' + createHash('sha1').update(corpo).digest('base64url').slice(0, 22) + '"';
    const f = { corpo, tipo: TIPOS[ext] || 'application/octet-stream', etag, ext };
    if (COMPRIMIR.has(ext) && corpo.length > 1024) {
      f.gzip = gzipSync(corpo, { level: 9 });
      f.br = brotliCompressSync(corpo, { params: { [zc.BROTLI_PARAM_QUALITY]: 11 } });
    }
    mapa.set(rota, f);
  }
  if (!mapa.has('/index.html')) throw new Error(`index.html não encontrado em ${dist}. Rode "npm run build".`);
  return mapa;
}

function cacheDe(rota) {
  if (rota.startsWith('/assets/')) return 'public, max-age=31536000, immutable'; // nome com hash
  if (rota === '/index.html') return 'no-cache';
  return 'public, max-age=3600';
}

// ---------------------------------------------------------------- limite por IP
const baldes = new Map();
export function permitir(ip, agora = Date.now(), limite = LIMITE) {
  const b = baldes.get(ip);
  if (!b || agora - b.inicio >= 60_000) {
    baldes.set(ip, { inicio: agora, n: 1 });
    return true;
  }
  b.n += 1;
  return b.n <= limite;
}
setInterval(() => {
  const agora = Date.now();
  for (const [ip, b] of baldes) if (agora - b.inicio >= 60_000) baldes.delete(ip);
}, 60_000).unref();

function ipDe(req) {
  const cf = TRUST_CF ? req.headers['cf-connecting-ip'] : null;
  return (typeof cf === 'string' && cf) || req.socket.remoteAddress || '?';
}

// ---------------------------------------------------------------- rotas
export function resolverRota(mapa, url) {
  let caminho;
  try {
    caminho = decodeURIComponent(new URL(url, 'http://x').pathname);
  } catch {
    return null;
  }
  if (caminho.includes('\0')) return null;
  if (caminho === '/') return '/index.html';
  if (mapa.has(caminho)) return caminho;
  // Rotas da SPA (/painel, /novo…) caem no index.html; arquivo inexistente com extensão é 404.
  if (!extname(caminho)) return '/index.html';
  return null;
}

export function criarServidor(mapa = carregar(), filtro = carregarRegras(), integracao = criarIntegracao()) {
  const servidor = http.createServer((req, res) => {
    const t0 = process.hrtime.bigint();
    const ip = ipDe(req);
    for (const [k, v] of Object.entries(SEGURANCA)) res.setHeader(k, v);
    const fim = (status) => {
      if (LOG) {
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        process.stdout.write(`${new Date().toISOString()} ${ip} ${req.method} ${String(req.url).slice(0, 200)} ${status} ${ms.toFixed(1)}ms\n`);
      }
    };
    const erro = (status, texto) => {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : texto);
      fim(status);
    };

    // Só os IPs e faixas liberados (server/ips-liberados.txt) chegam ao site, como no BenHermes.
    if (filtro.bloqueado(ip)) return erro(403, 'Acesso não liberado para este endereço.');
    if ((req.url || '').length > 2048) return erro(414, 'URL longa demais');
    if (!permitir(ip)) {
      res.setHeader('Retry-After', '60');
      return erro(429, 'Muitas requisições. Tente de novo em um minuto.');
    }
    // API de integração com o BenHermes (a única rota que aceita POST, e só com assinatura).
    const api = integracao.atender(req, res);
    if (api) {
      api.then(fim, (e) => { console.error('Integração BenHermes:', e); if (!res.headersSent) erro(500, 'Erro interno'); else fim(500); });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return erro(405, 'Método não permitido');
    }
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, versao: VERSAO, ativoHaSeg: Math.round((Date.now() - INICIO) / 1000) }));
      return fim(200);
    }

    const rota = resolverRota(mapa, req.url || '/');
    const f = rota && mapa.get(rota);
    if (!f) return erro(404, 'Não encontrado');

    res.setHeader('Cache-Control', cacheDe(rota));
    res.setHeader('ETag', f.etag);
    res.setHeader('Vary', 'Accept-Encoding');
    if (req.headers['if-none-match'] === f.etag) {
      res.writeHead(304);
      res.end();
      return fim(304);
    }
    const aceita = String(req.headers['accept-encoding'] || '');
    let corpo = f.corpo;
    if (f.br && /\bbr\b/.test(aceita)) {
      corpo = f.br;
      res.setHeader('Content-Encoding', 'br');
    } else if (f.gzip && /\bgzip\b/.test(aceita)) {
      corpo = f.gzip;
      res.setHeader('Content-Encoding', 'gzip');
    }
    res.writeHead(200, { 'Content-Type': f.tipo, 'Content-Length': corpo.length });
    res.end(req.method === 'HEAD' ? undefined : corpo);
    fim(200);
  });
  // Conexões lentas não prendem o processo.
  servidor.requestTimeout = 15_000;
  servidor.headersTimeout = 10_000;
  servidor.keepAliveTimeout = 5_000;
  servidor.maxHeadersCount = 64;
  return servidor;
}

// ---------------------------------------------------------------- subida
// No modo cluster o pm2 carrega o script por dentro (o argv[1] é o dele): pm_exec_path diz quem é.
const alvo = process.env.pm_exec_path || process.argv[1];
const ehPrincipal = !!alvo && resolve(alvo) === fileURLToPath(import.meta.url);
if (ehPrincipal) {
  const mapa = carregar();
  const filtro = carregarRegras();
  if (filtro.invalidas.length) console.warn(`IPs liberados ignorados (formato inválido): ${filtro.invalidas.join(', ')}`);
  if (!filtro.restringir || !filtro.regras.length) console.warn(`Atenção: ${resumoDoFiltro(filtro)}.`);
  const integracao = criarIntegracao();
  const servidor = criarServidor(mapa, filtro, integracao);
  servidor.listen(PORT, HOST, () => {
    console.log(`BenCalls ${VERSAO} no ar em http://${HOST}:${PORT} · ${mapa.size} arquivos · ${resumoDoFiltro(filtro)} · integração BenHermes ${integracao.ativa ? 'ligada' : 'desligada'} · pid ${process.pid}`);
    process.send?.('ready'); // pm2 wait_ready
  });
  let saindo = false;
  const desligar = (motivo) => {
    if (saindo) return;
    saindo = true;
    console.log(`Desligando (${motivo})…`);
    servidor.close(() => process.exit(0));
    servidor.closeIdleConnections?.();
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on('SIGTERM', () => desligar('SIGTERM'));
  process.on('SIGINT', () => desligar('SIGINT'));
  process.on('message', (m) => m === 'shutdown' && desligar('pm2'));
}
