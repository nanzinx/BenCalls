import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarEventos, separarCodigo } from '../src/lib/integracao-benhermes.ts';
import type { EstadoBenCalls, EventoBenHermes } from '../src/lib/integracao-benhermes.ts';
import { mapaDasMesas, whatsappDaBaia } from '../src/lib/whatsapp-baias.ts';
import type { LayoutBenCalls } from '../src/lib/whatsapp-baias.ts';
import { aplicarAcao } from '../src/lib/benhermes/whatsappManutencao.ts';

const T0 = new Date('2026-11-06T09:00:00.000Z');
const OP1 = { id: 'OP1', base: 'OP1', nome: 'Equipe 1', sala: 'Operacional', centro: ['SUP'], esq: 4, dir: 4, inicio: 'sup', padrao: ['grupo'], desativadas: {} } as unknown as LayoutBenCalls;

function estado(): EstadoBenCalls {
  let m = mapaDasMesas([OP1], {}, () => 'CARLA', T0);
  const alvo = whatsappDaBaia(m, 'OP1', 'E3', T0)!.alvo;
  m = aplicarAcao(m, alvo, 'BANIDO', T0);
  m = aplicarAcao(m, alvo, 'PEDIU_ANALISE', new Date(T0.getTime() + 60_000));
  return {
    whatsapp: m,
    layouts: [{ id: 'OP1', base: 'OP1', sala: 'Operacional', nome: 'Equipe 1' }],
    chamados: [
      { id: 179, layoutId: 'OP1', pos: 'E3', sitId: 'sW', status: 'Em Análise', titulo: 'WhatsApp banido', hist: [] },
      { id: 180, layoutId: 'OP1', pos: 'E3', sitId: 'sHeadset', status: 'Em Análise', titulo: 'Headset', hist: [] },
      { id: 181, layoutId: 'OP1', pos: 'E2', sitId: 'sW', status: 'Em Análise', titulo: 'WhatsApp banido', hist: [] }
    ]
  };
}
const liberado = (em = '2026-11-06T12:00:00.000Z', id = 'e1'): EventoBenHermes => ({
  id, tipo: 'whatsapp.situacao', em,
  dados: { codigo: 'OP1-E3', de: 'ANALISE', para: 'OK', acao: 'LIBERADO', estado: { situacao: 'OK', mudouEm: em }, manutencao: { id: 'm1', janela: 'MANHA' } }
});
const AGORA = Date.parse('2026-11-06T12:00:05.000Z');

test('manutenção no BenHermes libera a baia: WhatsApp fica OK e o chamado de WhatsApp fecha', () => {
  const st = estado();
  const ef = aplicarEventos(st, [liberado()], new Set(['sW']), AGORA);
  assert.equal(whatsappDaBaia(st.whatsapp, 'OP1', 'E3', new Date(AGORA))!.estado.situacao, 'OK');
  assert.equal(st.chamados[0].status, 'Concluído');
  assert.match(st.chamados[0].hist.at(-1)!.just!, /Resolvido no BenHermes: liberado na manutenção \(manhã\)/);
  assert.equal(st.chamados[1].status, 'Em Análise', 'chamado de outro assunto não fecha');
  assert.equal(st.chamados[2].status, 'Em Análise', 'chamado de outra baia não fecha');
  assert.deepEqual(ef.map((e) => e.tipo), ['chamado-concluido']);
  assert.equal(st.whatsapp!.historico.at(-1)!.para, 'OK');
  assert.equal(st.integracao!.benhermes!.log[0].resultado, 'aplicado');
});

test('o mesmo evento duas vezes não faz nada na segunda', () => {
  const st = estado();
  aplicarEventos(st, [liberado()], new Set(['sW']), AGORA);
  const h = st.whatsapp!.historico.length;
  assert.deepEqual(aplicarEventos(st, [liberado()], new Set(['sW']), AGORA), []);
  assert.equal(st.whatsapp!.historico.length, h);
});

test('evento mais antigo que a mudança daqui não desfaz o mapa (mas ainda fecha o chamado)', () => {
  const st = estado();
  aplicarEventos(st, [liberado('2026-11-06T08:00:00.000Z')], new Set(['sW']), AGORA);
  assert.equal(whatsappDaBaia(st.whatsapp, 'OP1', 'E3', new Date(AGORA))!.estado.situacao, 'ANALISE');
  assert.equal(st.chamados[0].status, 'Concluído');
});

test('baia que caiu no BenHermes avisa a supervisão; manutenção concluída avisa o TI', () => {
  const st = estado();
  const ef = aplicarEventos(st, [
    { id: 'b', tipo: 'whatsapp.situacao', em: '2026-11-06T12:00:00.000Z', dados: { codigo: 'OP1-D1', de: 'OK', para: 'BANIDO', acao: 'BANIDO', estado: { situacao: 'BANIDO', mudouEm: '2026-11-06T12:00:00.000Z' } } },
    { id: 'm', tipo: 'manutencao.concluida', em: '2026-11-06T12:30:00.000Z', dados: { id: 'm1', inicio: '2026-11-06T12:00:00.000Z', fim: '2026-11-06T12:30:00.000Z', janela: 'ALMOCO', conferidos: 6, acoes: [{ acao: 'BANIDO', codigo: 'OP1-D1' }] } }
  ], new Set(['sW']), AGORA);
  assert.deepEqual(ef.map((e) => e.tipo), ['whatsapp', 'manutencao']);
  assert.equal(whatsappDaBaia(st.whatsapp, 'OP1', 'D1', new Date(AGORA))!.estado.situacao, 'BANIDO');
  assert.match((ef[1] as { texto: string }).texto, /almoço concluída no BenHermes: 6 celular/);
});

test('baia que não existe aqui fica registrada como ignorada', () => {
  const st = estado();
  aplicarEventos(st, [{ ...liberado(), id: 'z', dados: { ...(liberado() as { dados: object }).dados, codigo: 'OP9-E1' } } as EventoBenHermes], new Set(['sW']), AGORA);
  assert.equal(st.integracao!.benhermes!.log[0].resultado, 'ignorado');
  assert.deepEqual(separarCodigo('DG-M1-D2'), { sigla: 'DG-M1', posicao: 'D2' });
});

// Contrato: eventos de verdade gerados pelo BenHermes (server/integracaoBenCalls.ts, eventosDaMudanca)
// numa manutenção. Se o BenHermes mudar o formato, este teste quebra aqui.
import { readFileSync } from 'node:fs';
import { lerLote, enxugar } from '../server/integracao/protocolo.mjs';

test('contrato: os eventos do BenHermes passam na API e funcionam no BenCalls', () => {
  const lote = lerLote(JSON.parse(readFileSync(new URL('./fixtures/eventos-benhermes.json', import.meta.url), 'utf8')));
  assert.equal(lote.erro, undefined);
  const enxutos = lote.eventos!.map(enxugar) as EventoBenHermes[];
  assert.deepEqual(enxutos.map((e) => e.tipo), ['whatsapp.situacao', 'whatsapp.situacao', 'whatsapp.situacao', 'manutencao.concluida']);
  const st = estado();
  st.chamados.push({ id: 182, layoutId: 'OP1', pos: 'D2', sitId: 'sPerdido', status: 'Em Execução', titulo: 'Número perdido', hist: [] });
  const ef = aplicarEventos(st, enxutos, new Set(['sW', 'sPerdido']), AGORA);
  assert.equal(whatsappDaBaia(st.whatsapp, 'OP1', 'D2', new Date(AGORA))!.estado.situacao, 'OK');
  assert.equal(whatsappDaBaia(st.whatsapp, 'OP1', 'E1', new Date(AGORA))!.estado.situacao, 'RESTRINGIDO');
  assert.equal(st.chamados.find((c) => c.id === 182)!.status, 'Concluído');
  assert.match(st.chamados.find((c) => c.id === 182)!.hist.at(-1)!.just!, /chip trocado na manutenção \(manhã\), com chip novo/);
  assert.ok(ef.some((e) => e.tipo === 'manutencao'));
});

test('análise pedida no BenHermes deixa o chamado aguardando o WhatsApp; perdido volta ao TI', () => {
  const st = estado();
  const ev = (id: string, para: 'ANALISE' | 'PERMANENTE', acao: 'PEDIU_ANALISE' | 'PERDIDO', em: string): EventoBenHermes => ({
    id, tipo: 'whatsapp.situacao', em,
    dados: { codigo: 'OP1-E3', de: 'ANALISE', para, acao, estado: { situacao: para, mudouEm: em, ...(para === 'ANALISE' ? { analisePedidaEm: em } : {}) } }
  });
  const ef = aplicarEventos(st, [ev('a1', 'ANALISE', 'PEDIU_ANALISE', '2026-11-06T11:00:00.000Z')], new Set(['sW']), Date.parse('2026-11-06T11:00:05.000Z'));
  assert.deepEqual(ef.map((e) => e.tipo), ['chamado-status']);
  assert.equal(st.chamados[0].status, 'Pendente');
  assert.equal(st.chamados[0].aguardandoWhatsapp?.etapa, 'analise');
  const ef2 = aplicarEventos(st, [ev('a2', 'PERMANENTE', 'PERDIDO', '2026-11-06T13:00:00.000Z')], new Set(['sW']), Date.parse('2026-11-06T13:00:05.000Z'));
  assert.ok(ef2.some((e) => e.tipo === 'chamado-status'));
  assert.equal(st.chamados[0].status, 'Em Análise');
  assert.equal(st.chamados[0].aguardandoWhatsapp, null);
});
