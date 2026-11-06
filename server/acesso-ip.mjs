// Acesso por IP: só entram os IPs e faixas liberados (IPv4 e IPv6, com ou sem CIDR), como no
// BenHermes (ALLOWED_IPS). Todo o resto recebe 403. Sem dependências.
//
// Usado pelo servidor de produção (servidor.mjs, no pm2/Docker) e pelo Vite em `npm run dev`
// e `npm run preview` (vite.config.js), para o comportamento ser o mesmo em todo lugar.
//
// As regras ficam em server/ips-liberados.txt (uma por linha, # para comentário) e podem ser
// somadas pela variável IPS_LIBERADOS (separadas por vírgula). RESTRINGIR_IPS=0 desliga a
// restrição (só para testes locais: não use em produção).
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const ARQUIVO_PADRAO = join(AQUI, 'ips-liberados.txt');

function ipv4(s) {
  const p = s.split('.');
  if (p.length !== 4) return null;
  let n = 0n;
  for (const x of p) {
    if (!/^\d{1,3}$/.test(x) || Number(x) > 255) return null;
    n = (n << 8n) | BigInt(Number(x));
  }
  return n;
}

function ipv6(s) {
  let txt = s.split('%')[0].toLowerCase(); // tira o "zone id" (fe80::1%eth0)
  // IPv4 no fim (::ffff:1.2.3.4) vira dois grupos hexadecimais.
  const m = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(txt);
  if (m) {
    const v4 = ipv4(m[2]);
    if (v4 === null) return null;
    txt = `${m[1]}${(v4 >> 16n).toString(16)}:${(v4 & 0xffffn).toString(16)}`;
  }
  const partes = txt.split('::');
  if (partes.length > 2) return null;
  const esq = partes[0] ? partes[0].split(':') : [];
  const dir = partes.length === 2 && partes[1] ? partes[1].split(':') : [];
  const faltam = 8 - esq.length - dir.length;
  if (partes.length === 1 ? esq.length !== 8 : faltam < 1) return null;
  const grupos = [...esq, ...Array(partes.length === 2 ? faltam : 0).fill('0'), ...dir];
  let n = 0n;
  for (const g of grupos) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    n = (n << 16n) | BigInt(parseInt(g, 16));
  }
  return n;
}

/** "201.93.163.133" | "2804:431::1" | "::ffff:201.93.163.133" -> { v: 4|6, n } (IPv4 mapeado vira IPv4). */
export function lerIp(texto) {
  const s = String(texto || '').trim();
  if (!s) return null;
  if (s.includes(':')) {
    const n = ipv6(s);
    if (n === null) return null;
    if (n >> 32n === 0xffffn) return { v: 4, n: n & 0xffffffffn }; // ::ffff:a.b.c.d
    return { v: 6, n };
  }
  const n = ipv4(s);
  return n === null ? null : { v: 4, n };
}

/** "2804:431:80f7:7700::/48" ou "201.93.163.133" -> regra com a rede já mascarada. */
export function lerRegra(texto) {
  const original = String(texto || '').trim();
  const [end, pre] = original.split('/');
  const ip = lerIp(end);
  if (!ip) return null;
  const total = ip.v === 4 ? 32 : 128;
  const bits = pre === undefined ? total : Number(pre);
  if (!Number.isInteger(bits) || bits < 0 || bits > total) return null;
  const mascara = bits === 0 ? 0n : ((1n << BigInt(bits)) - 1n) << BigInt(total - bits);
  return { texto: original, v: ip.v, bits, mascara, rede: ip.n & mascara };
}

/**
 * Lista de regras liberadas -> filtro. `liberado(ip)` devolve a regra que deixa entrar (ou null);
 * `bloqueado(ip)` é o contrário. Lista vazia com a restrição ligada não deixa ninguém entrar
 * (falha fechada): melhor um aviso claro do que o site aberto por engano.
 */
export function criarFiltro(textos, { restringir = true } = {}) {
  const regras = [];
  const invalidas = [];
  for (const t of textos) {
    const r = lerRegra(t);
    if (r) regras.push(r);
    else invalidas.push(t);
  }
  const liberado = (ip) => {
    const x = lerIp(ip);
    if (!x) return null;
    return regras.find((r) => r.v === x.v && (x.n & r.mascara) === r.rede) || null;
  };
  const bloqueado = (ip) => restringir && !liberado(ip);
  return { liberado, bloqueado, regras, invalidas, restringir };
}

/** Lê o arquivo de regras + a variável IPS_LIBERADOS. */
export function carregarRegras(arquivo = ARQUIVO_PADRAO, extra = process.env.IPS_LIBERADOS || '', restringir = process.env.RESTRINGIR_IPS !== '0') {
  const linhas = existsSync(arquivo) ? readFileSync(arquivo, 'utf8').split(/\r?\n/) : [];
  const doArquivo = linhas.map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
  const daVariavel = extra.split(',').map((x) => x.trim()).filter(Boolean);
  return criarFiltro([...doArquivo, ...daVariavel], { restringir });
}

/** Uma linha para o log de subida: quantas regras e se a restrição está ligada. */
export function resumoDoFiltro(filtro) {
  if (!filtro.restringir) return 'restrição de IP DESLIGADA (RESTRINGIR_IPS=0)';
  if (!filtro.regras.length) return 'nenhum IP liberado: ninguém consegue entrar (confira server/ips-liberados.txt)';
  return `${filtro.regras.length} IPs/faixas liberados`;
}

/** Middleware (connect/Vite) que responde 403 para IPs fora da lista de liberados. */
export function middlewareBloqueio(filtro = carregarRegras(), { confiarCloudflare = false } = {}) {
  return (req, res, next) => {
    const cf = confiarCloudflare ? req.headers['cf-connecting-ip'] : null;
    const ip = (typeof cf === 'string' && cf) || req.socket?.remoteAddress || '';
    if (filtro.bloqueado(ip)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Acesso não liberado para este endereço.');
      return;
    }
    next();
  };
}
