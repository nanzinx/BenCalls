import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { carregar, criarServidor } from '../server/servidor.mjs';
import { criarFiltro } from '../server/acesso-ip.mjs';
import { criarIntegracao } from '../server/integracao/rotas.mjs';
import { assinar, conferir } from '../server/integracao/assinatura.mjs';
import { conferirEvento, lerLote, enxugar } from '../server/integracao/protocolo.mjs';
import { enviarEventos } from '../server/integracao/emissor.mjs';

const SEGREDO = 'x'.repeat(40);
const ev = (o = {}) => ({
  id: 'wpp:OP1-E3:2026-11-06T12:00:00.000Z:OK', tipo: 'whatsapp.situacao', em: '2026-11-06T12:00:00.000Z',
  dados: { codigo: 'OP1-E3', de: 'ANALISE', para: 'OK', acao: 'LIBERADO', operador: 'CAMILA PIRES', numeroNovo: '(11) 98888-0000',
    estado: { situacao: 'OK', mudouEm: '2026-11-06T12:00:00.000Z' }, manutencao: { id: 'm1', janela: 'MANHA' } },
  ...o
});

test('assinatura: confere, recusa adulterada, fora da janela e mal formada', () => {
  const t = String(Date.now());
  const a = assinar(SEGREDO, t, '{"a":1}');
  assert.equal(conferir({ segredo: SEGREDO, tempo: t, assinatura: a, corpo: '{"a":1}' }), null);
  assert.match(conferir({ segredo: SEGREDO, tempo: t, assinatura: a, corpo: '{"a":2}' }), /não confere/);
  assert.match(conferir({ segredo: 'y'.repeat(40), tempo: t, assinatura: a, corpo: '{"a":1}' }), /não confere/);
  assert.match(conferir({ segredo: SEGREDO, tempo: String(Date.now() - 6 * 60_000), assinatura: a, corpo: '{"a":1}' }), /janela/);
  assert.match(conferir({ segredo: SEGREDO, tempo: t, assinatura: 'abc', corpo: '{"a":1}' }), /mal formada/);
  assert.match(conferir({ segredo: SEGREDO, tempo: 'ontem', assinatura: a, corpo: '{"a":1}' }), /tempo/);
});

test('protocolo: confere os campos e a versão enxuta não leva nome nem número', () => {
  assert.equal(conferirEvento(ev()), null);
  assert.match(conferirEvento(ev({ tipo: 'outro' })), /tipo/);
  assert.match(conferirEvento(ev({ dados: { ...ev().dados, codigo: '../etc' } })), /codigo/);
  assert.match(conferirEvento(ev({ dados: { ...ev().dados, para: 'BANIDO' } })), /diferente/);
  assert.match(conferirEvento(ev({ em: '06/11/2026' })), /em inválido/);
  assert.equal(conferirEvento(ev({ dados: { ...ev().dados, codigo: 'DG-M1-D2' } })), null);
  assert.match(lerLote({ eventos: Array(101).fill(ev()) }).erro, /no máximo/);
  const e = enxugar(ev());
  assert.equal(e.dados.operador, undefined);
  assert.equal(e.dados.numeroNovo, undefined);
  assert.equal(e.dados.chipTrocado, true);
  assert.deepEqual(e.dados.manutencao, { id: 'm1', janela: 'MANHA' });
});

let dist, dados, srv, base;
before(async () => {
  dist = mkdtempSync(join(tmpdir(), 'bencalls-dist-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>BenCalls</title>');
  dados = mkdtempSync(join(tmpdir(), 'bencalls-dados-'));
  srv = criarServidor(carregar(dist), criarFiltro(['127.0.0.1', '::1']), criarIntegracao({ segredo: SEGREDO, dadosDir: dados, log: {} }));
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${srv.address().port}/api/integracoes/benhermes`;
});
after(() => { srv.close(); rmSync(dist, { recursive: true, force: true }); rmSync(dados, { recursive: true, force: true }); });

test('API: recebe evento assinado, ignora repetido e o front lê a versão enxuta', async () => {
  assert.deepEqual(await (await fetch(base + '/status')).json(), { ativa: true, versao: 1 });
  const r1 = await enviarEventos({ url: base + '/eventos', segredo: SEGREDO, eventos: [ev()], origem: 'benhermes' });
  assert.equal(r1.status, 202);
  assert.deepEqual(r1.resposta, { recebidos: 1, duplicados: 0 });
  const r2 = await enviarEventos({ url: base + '/eventos', segredo: SEGREDO, eventos: [ev()], origem: 'benhermes' });
  assert.deepEqual(r2.resposta, { recebidos: 0, duplicados: 1 });
  const lido = await (await fetch(base + '/eventos?desde=0')).json();
  assert.equal(lido.eventos.length, 1);
  assert.equal(lido.eventos[0].dados.operador, undefined);
  assert.ok(lido.cursor > 0);
  assert.equal((await (await fetch(base + `/eventos?desde=${lido.cursor}`)).json()).eventos.length, 0);
  // gravado no arquivo, sem o nome do operador
  const arq = readFileSync(join(dados, 'benhermes-eventos.jsonl'), 'utf8');
  assert.ok(arq.includes('OP1-E3') && !arq.includes('CAMILA'));
});

test('API: recusa sem assinatura, assinatura errada, formato errado e corpo grande', async () => {
  const corpo = JSON.stringify({ eventos: [ev({ id: 'outro' })] });
  const semAss = await fetch(base + '/eventos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo });
  assert.equal(semAss.status, 401);
  const errada = await enviarEventos({ url: base + '/eventos', segredo: 'z'.repeat(40), eventos: [ev({ id: 'outro' })], tentativas: 1 });
  assert.equal(errada.status, 401);
  const invalido = await enviarEventos({ url: base + '/eventos', segredo: SEGREDO, eventos: [{ id: 'x', tipo: 'whatsapp.situacao' }], tentativas: 1 });
  assert.equal(invalido.status, 422);
  const t = String(Date.now());
  const grande = JSON.stringify({ eventos: [ev({ id: 'g', dados: { ...ev().dados, operador: 'x'.repeat(70_000) } })] });
  const r = await fetch(base + '/eventos', { method: 'POST', body: grande, headers: { 'Content-Type': 'application/json', 'X-Integracao-Tempo': t, 'X-Integracao-Assinatura': assinar(SEGREDO, t, grande) } }).catch(() => ({ status: 413 }));
  assert.equal(r.status, 413);
  assert.equal((await fetch(base + '/eventos', { method: 'DELETE' })).status, 405);
  // fora da API o servidor continua só GET/HEAD
  assert.equal((await fetch(base.replace('/api/integracoes/benhermes', '/'), { method: 'POST' })).status, 405);
});

test('API desligada sem segredo', async () => {
  const s = criarServidor(carregar(dist), criarFiltro(['127.0.0.1', '::1']), criarIntegracao({ segredo: '', log: {} }));
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const b = `http://127.0.0.1:${s.address().port}/api/integracoes/benhermes`;
  assert.deepEqual(await (await fetch(b + '/status')).json(), { ativa: false, versao: 1 });
  assert.equal((await fetch(b + '/eventos')).status, 503);
  s.close();
});
