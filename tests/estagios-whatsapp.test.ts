import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etapaDoWhatsapp, sincronizarChamados, revisarAguardando, passosDoCaminho } from '../src/lib/estagios-whatsapp.ts';
import type { ChamadoWhatsapp } from '../src/lib/estagios-whatsapp.ts';
import type { EstadoWhatsapp } from '../src/lib/benhermes/whatsapp.ts';

const T = new Date('2026-11-11T12:00:00.000Z');
const H = 3_600_000;
const iso = (msAtras: number) => new Date(T.getTime() - msAtras).toISOString();
const banido: EstadoWhatsapp = { situacao: 'BANIDO', mudouEm: iso(3 * H) };
const analise: EstadoWhatsapp = { situacao: 'ANALISE', mudouEm: iso(2 * H), analisePedidaEm: iso(2 * H) };
const restrito: EstadoWhatsapp = { situacao: 'RESTRINGIDO', mudouEm: iso(5 * H), restritoAte: new Date(T.getTime() + 43 * H).toISOString() };
const vencido: EstadoWhatsapp = { situacao: 'RESTRINGIDO', mudouEm: iso(25 * H), restritoAte: iso(H) };
const ok: EstadoWhatsapp = { situacao: 'OK', mudouEm: iso(0) };
const perdido: EstadoWhatsapp = { situacao: 'PERMANENTE', mudouEm: iso(0) };

test('estágios: em análise e restringido são de esperar; os outros têm próximo passo', () => {
  assert.equal(etapaDoWhatsapp(banido, T).aguardandoWhatsapp, false);
  assert.match(etapaDoWhatsapp(banido, T).proximoPasso, /pedir a análise/i);
  const a = etapaDoWhatsapp(analise, T);
  assert.equal(a.id, 'analise');
  assert.equal(a.aguardandoWhatsapp, true);
  assert.match(a.descricao, /até 1 dia/);
  assert.match(a.quandoTexto!, /em até 22h/);
  const atrasada = etapaDoWhatsapp({ ...analise, analisePedidaEm: iso(26 * H) }, T);
  assert.equal(atrasada.id, 'analise-atrasada');
  assert.equal(atrasada.aguardandoWhatsapp, false);
  const r = etapaDoWhatsapp(restrito, T);
  assert.equal(r.aguardandoWhatsapp, true);
  assert.match(r.descricao, /WhatsApp Web/);
  assert.match(r.quandoTexto!, /faltam 1d 19h/);
  assert.equal(etapaDoWhatsapp(vencido, T).id, 'restricao-vencida');
  assert.match(etapaDoWhatsapp(perdido, T).proximoPasso, /trocar o chip/i);
  assert.deepEqual(passosDoCaminho('restringido').map((p) => p.titulo), ['Restringido', 'Prazo terminou', 'Voltou']);
  assert.equal(passosDoCaminho('perdido')[2].titulo, 'Perdido · trocar o chip');
});

const chamados = (): ChamadoWhatsapp[] => [
  { id: 1, layoutId: 'OP1', pos: 'E3', sitId: 'sW', status: 'Em Execução', tecnicoId: 'u3', hist: [] },
  { id: 2, layoutId: 'OP1', pos: 'E3', sitId: 'sHeadset', status: 'Em Execução', tecnicoId: 'u3', hist: [] },
  { id: 3, layoutId: 'OP1', pos: 'E2', sitId: 'sW', status: 'Em Análise', hist: [] }
];
const baia = { layoutId: 'OP1', pos: 'E3' };
const origem = { usuario: 'u3', onde: 'Controle de WhatsApps' };
const W = new Set(['sW']);

test('em análise: o chamado de WhatsApp fica pendente aguardando o WhatsApp (os outros não mudam)', () => {
  const cs = chamados();
  const m = sincronizarChamados(cs, baia, analise, W, T.getTime(), { ...origem, acao: 'pedi análise' });
  assert.deepEqual(m.map((x) => x.tipo), ['aguardando']);
  assert.equal(cs[0].status, 'Pendente');
  assert.equal(cs[0].aguardandoWhatsapp?.etapa, 'analise');
  assert.match(cs[0].hist.at(-1)!.just!, /Aguardando o WhatsApp: em análise pelo whatsapp .*Sem manutenção até a resposta/);
  assert.equal(cs[1].status, 'Em Execução');
  assert.equal(cs[2].status, 'Em Análise');
});

test('análise negada: número perdido volta para o TI com o próximo passo', () => {
  const cs = chamados();
  sincronizarChamados(cs, baia, analise, W, T.getTime(), origem);
  const m = sincronizarChamados(cs, baia, perdido, W, T.getTime() + 1000, { ...origem, acao: 'perdido' });
  assert.deepEqual(m.map((x) => x.tipo), ['voltou-ao-ti']);
  assert.equal(cs[0].status, 'Em Execução');
  assert.equal(cs[0].aguardandoWhatsapp, null);
  assert.match(cs[0].hist.at(-1)!.just!, /perdido\. Trocar o chip/);
});

test('número de volta a OK conclui o chamado, mesmo se estava aguardando', () => {
  const cs = chamados();
  sincronizarChamados(cs, baia, restrito, W, T.getTime(), origem);
  assert.equal(cs[0].status, 'Pendente');
  const m = sincronizarChamados(cs, baia, ok, W, T.getTime() + 1000, { ...origem, acao: 'voltou' });
  assert.deepEqual(m.map((x) => x.tipo), ['concluido']);
  assert.equal(cs[0].status, 'Concluído');
  assert.match(cs[0].hist.at(-1)!.just!, /Resolvido no Controle de WhatsApps: voltou/);
});

test('banido só anota (há o que fazer: pedir a análise); aguardando confirmação não muda', () => {
  const cs = chamados();
  assert.deepEqual(sincronizarChamados(cs, baia, banido, W, T.getTime(), origem).map((x) => x.tipo), ['anotado']);
  assert.equal(cs[0].status, 'Em Execução');
  cs[0].status = 'Aguardando Consenso';
  assert.deepEqual(sincronizarChamados(cs, baia, analise, W, T.getTime(), origem), []);
  assert.equal(cs[0].status, 'Aguardando Consenso');
});

test('prazo que vence sozinho: restrição terminou devolve o chamado ao TI', () => {
  const cs = chamados();
  sincronizarChamados(cs, baia, restrito, W, T.getTime(), origem);
  assert.deepEqual(revisarAguardando(cs, () => restrito, T.getTime()), []);
  const m = revisarAguardando(cs, () => vencido, T.getTime(), 'sistema');
  assert.equal(m.length, 1);
  assert.equal(cs[0].status, 'Em Execução');
  assert.match(cs[0].hist.at(-1)!.just!, /Restrição terminou\. Conferir no WhatsApp Web/);
});
