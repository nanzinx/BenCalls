import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapaDasMesas, whatsappDaBaia, divergencias, usarOcupantesDoBenCalls, trocarOperador, alertasUrgentes, tomDaSituacao, centroDoLayout } from '../src/lib/whatsapp-baias.ts';
import type { LayoutBenCalls } from '../src/lib/whatsapp-baias.ts';
import { aplicarAcao } from '../src/lib/benhermes/whatsappManutencao.ts';
import { exportarMapa, importarMapa } from '../src/lib/benhermes/whatsappBaias.ts';
import { novoCelular, adicionarCelularNoMapa } from '../src/lib/benhermes/celulares.ts';

const AGORA = new Date('2026-11-06T10:00:00');
const depois = (h: number) => new Date(AGORA.getTime() + h * 3_600_000);
const OP1: LayoutBenCalls = { id: 'OP1', base: 'OP1', nome: 'Equipe 1', sala: 'Operacional', centro: ['SUP'], esq: 4, dir: 4, inicio: 'sup', padrao: ['grupo'], desativadas: {}, supervisorId: 'u1' } as LayoutBenCalls;
const DG: LayoutBenCalls = { id: 'DG-M2', base: 'DG-M2', nome: 'Mesa 2', sala: 'Digital', centro: [], esq: 3, dir: 3, inicio: 'porta', padrao: ['grupo'], desativadas: { D3: true } } as LayoutBenCalls;
const ocup = { 'OP1:E1': { nome: 'Ana Lima' }, 'OP1:D2': { nome: 'Bruno Sá' } };
const base = () => mapaDasMesas([OP1, DG], ocup, (id) => (id === 'u1' ? 'Carla Souza' : ''), AGORA);

test('o mapa nasce das mesas do BenCalls com as mesmas siglas, salas e ocupantes', () => {
  const m = base();
  assert.deepEqual(m.salas.map((s) => s.nome), ['Operacional', 'Digital']);
  const op1 = m.salas[0].mesas[0];
  assert.equal(op1.sigla, 'OP1');
  assert.equal(op1.supervisor, 'CARLA SOUZA');
  assert.equal(op1.supervisorUserId, 'u1');
  assert.equal(op1.lugares.E1.operador, 'ANA LIMA');
  const dg = m.salas[1].mesas[0];
  assert.equal(dg.centro, 'NENHUM');
  assert.deepEqual(dg.desativadas, ['D3']);
  assert.equal(dg.lugares.D3, undefined);
  assert.equal(centroDoLayout(['SUP', 'SUB']), 'SUPSUB');
});

test('o mapa gerado é o mesmo .json que o BenHermes importa', () => {
  const m = base();
  const volta = importarMapa(exportarMapa(m, AGORA), AGORA);
  assert.deepEqual(volta.salas, m.salas);
});

test('a baia do BenCalls acha o WhatsApp dela e o ciclo do banimento segue as regras do BenHermes', () => {
  let m = base();
  const w = whatsappDaBaia(m, 'OP1', 'E1', AGORA)!;
  assert.equal(w.codigo, 'OP1-E1');
  assert.deepEqual(w.acoes, ['BANIDO', 'RESTRINGIDO']);
  m = aplicarAcao(m, w.alvo, 'BANIDO', AGORA);
  const banido = whatsappDaBaia(m, 'OP1', 'E1', AGORA)!;
  assert.equal(banido.estado.situacao, 'BANIDO');
  assert.equal(banido.atencao, 'PEDIR_ANALISE');
  assert.equal(tomDaSituacao(banido.estado, AGORA), 'ruim');
  assert.equal(alertasUrgentes(m, AGORA).length, 1);
  m = aplicarAcao(m, banido.alvo, 'PEDIU_ANALISE', AGORA);
  assert.equal(whatsappDaBaia(m, 'OP1', 'E1', AGORA)!.atencao, null);
  assert.equal(whatsappDaBaia(m, 'OP1', 'E1', depois(25))!.atencao, 'ANALISE_ATRASADA');
});

test('SUB, baia desativada, supervisor sem WhatsApp e mesa que não existe não têm WhatsApp', () => {
  const m = base();
  assert.equal(whatsappDaBaia(m, 'DG-M2', 'D3', AGORA), null);
  assert.equal(whatsappDaBaia(m, 'DG-M2', 'SUP', AGORA), null);
  assert.equal(whatsappDaBaia(m, 'OP9', 'E1', AGORA), null);
  assert.equal(whatsappDaBaia(null, 'OP1', 'E1', AGORA), null);
  assert.ok(whatsappDaBaia(m, 'OP1', 'SUP', AGORA));
});

test('baia com celular mostra o celular e a vaga ligada', () => {
  let m = base();
  const mesaId = m.salas[0].mesas[0].id;
  m = adicionarCelularNoMapa(m, novoCelular({ cor: 'Azul', hex: '#2563eb', apelido: '', marca: 'IPHONE', usuarios: 1, mesaId }, m, AGORA), AGORA);
  const w = whatsappDaBaia(m, 'OP1', 'E1', AGORA)!;
  assert.equal(w.ligada?.celular.cor, 'Azul');
});

test('divergências: operador diferente, mesa faltando e formato', () => {
  const m = base();
  const novaOcup = { ...ocup, 'OP1:E1': { nome: 'Ana Lima' }, 'OP1:E2': { nome: 'Caio' } };
  const d = divergencias(m, [OP1, DG, { ...OP1, id: 'OP2', base: 'OP2' }], novaOcup);
  assert.deepEqual(d.map((x) => x.tipo).sort(), ['mesa-sem-whatsapp', 'operador']);
  assert.equal(d.find((x) => x.tipo === 'operador')!.codigo, 'OP1-E2');
  const f = divergencias(m, [{ ...OP1, esq: 5 }, DG], ocup);
  assert.equal(f[0].tipo, 'formato');
  // acentos e maiúsculas não contam como diferença
  assert.equal(divergencias(m, [OP1, DG], { ...ocup, 'OP1:E1': { nome: 'ana  lima' } }).length, 0);
});

test('usar os ocupantes do BenCalls grava a troca no histórico do WhatsApp', () => {
  const m = base();
  const r = usarOcupantesDoBenCalls(m, [OP1, DG], { ...ocup, 'OP1:E1': { nome: 'Dora' } }, AGORA);
  assert.equal(r.trocas, 1);
  assert.equal(r.mapa.salas[0].mesas[0].lugares.E1.operador, 'DORA');
  assert.equal(r.mapa.historico.at(-1)?.tipo, 'OPERADOR');
  const t = trocarOperador(r.mapa, 'OP1', 'E1', 'Eva', AGORA);
  assert.equal(t.salas[0].mesas[0].lugares.E1.operador, 'EVA');
  assert.equal(trocarOperador(t, 'OP1', 'E1', 'eva', AGORA), t);
});
