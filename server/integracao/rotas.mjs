// API de integração BenHermes → BenCalls (versão 1). Usada pelo servidor de produção e pelo Vite.
//
//   POST /api/integracoes/benhermes/eventos   o BenHermes avisa o que mudou (assinado)
//   GET  /api/integracoes/benhermes/eventos   o front do BenCalls busca o que chegou (?desde=ms)
//   GET  /api/integracoes/benhermes/status    a integração está ligada?
//
// Variáveis: BENHERMES_SEGREDO (ou BENHERMES_SEGREDO_ARQUIVO, para segredo do Docker) liga a
// integração; DADOS_DIR é a pasta do arquivo de eventos (sem ela, ficam só na memória).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conferir, TAMANHO_MINIMO_SEGREDO } from './assinatura.mjs';
import { lerLote } from './protocolo.mjs';
import { criarFila } from './fila.mjs';

export const BASE = '/api/integracoes/benhermes';
const MAX_CORPO = 64 * 1024;

export function segredoDoAmbiente(env = process.env) {
  let s = (env.BENHERMES_SEGREDO || '').trim();
  if (!s && env.BENHERMES_SEGREDO_ARQUIVO) {
    try { s = readFileSync(env.BENHERMES_SEGREDO_ARQUIVO, 'utf8').trim(); } catch (e) {
      // Arquivo configurado mas ilegível (ex.: dono errado no Docker): avisa, em vez de desligar calado.
      console.warn(`Integração BenHermes desligada: não deu para ler ${env.BENHERMES_SEGREDO_ARQUIVO} (${e.code || e.message}).`);
      s = '';
    }
  }
  if (s && s.length < TAMANHO_MINIMO_SEGREDO) {
    console.warn(`Integração BenHermes desligada: o segredo precisa de ${TAMANHO_MINIMO_SEGREDO}+ caracteres (gere com: openssl rand -hex 32).`);
    return '';
  }
  return s;
}

export function criarIntegracao({ segredo = segredoDoAmbiente(), dadosDir = process.env.DADOS_DIR || '', agora = () => Date.now(), log = console } = {}) {
  const fila = criarFila({ arquivo: dadosDir ? join(dadosDir, 'benhermes-eventos.jsonl') : null });
  const ativa = !!segredo;

  const json = (res, status, corpo) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(corpo));
    return status;
  };

  const lerCorpo = (req) => new Promise((ok, falha) => {
    const partes = [];
    let total = 0;
    req.on('data', (p) => {
      total += p.length;
      if (total > MAX_CORPO) { falha(Object.assign(new Error('corpo grande demais'), { status: 413 })); req.destroy(); return; }
      partes.push(p);
    });
    req.on('end', () => ok(Buffer.concat(partes).toString('utf8')));
    req.on('error', falha);
  });

  /** Atende as rotas da integração. Devolve o status (Promise) ou null se a rota não é dela. */
  function atender(req, res) {
    const url = new URL(req.url || '/', 'http://x');
    if (!url.pathname.startsWith(BASE + '/')) return null;
    const rota = url.pathname.slice(BASE.length);

    if (rota === '/status' && req.method === 'GET') return Promise.resolve(json(res, 200, { ativa, versao: 1 }));

    if (rota === '/eventos' && req.method === 'GET') {
      if (!ativa) return Promise.resolve(json(res, 503, { erro: 'integração com o BenHermes desligada' }));
      const desde = Number(url.searchParams.get('desde') || 0);
      return Promise.resolve(json(res, 200, fila.depois(Number.isFinite(desde) ? desde : 0)));
    }

    if (rota === '/eventos' && req.method === 'POST') {
      return (async () => {
        if (!ativa) return json(res, 503, { erro: 'integração com o BenHermes desligada' });
        if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) return json(res, 415, { erro: 'use Content-Type: application/json' });
        let corpo;
        try { corpo = await lerCorpo(req); } catch (e) { return json(res, e.status || 400, { erro: e.message }); }
        const motivo = conferir({
          segredo, corpo, agora: agora(),
          tempo: req.headers['x-integracao-tempo'],
          assinatura: req.headers['x-integracao-assinatura']
        });
        if (motivo) {
          log.warn?.(`Integração BenHermes: mensagem recusada (${motivo}).`);
          return json(res, 401, { erro: `não autorizado: ${motivo}` });
        }
        let dados;
        try { dados = JSON.parse(corpo); } catch { return json(res, 400, { erro: 'JSON inválido' }); }
        const lote = lerLote(dados);
        if (lote.erro) return json(res, 422, { erro: lote.erro });
        const r = fila.adicionar(lote.eventos, agora());
        return json(res, 202, { recebidos: r.novos, duplicados: r.duplicados });
      })();
    }

    res.setHeader('Allow', rota === '/eventos' ? 'GET, POST' : 'GET');
    return Promise.resolve(json(res, 405, { erro: 'método não permitido' }));
  }

  return { ativa, atender, fila };
}
