import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarCodigo, codigoLocal, posicoesDaMesa, linhasDaMesa, validarMesa, lerCodigo } from '../src/lib/labels.ts';
import { alertaTriagem, passoOk, ehPrioritario, ordemFila, detectarIncidentes, podeReabrir, podeTransicionar, sugestaoCompra } from '../src/lib/rules.ts';
import { contraste, nivelContraste } from '../src/lib/contrast.ts';
import { seedLayouts, seed } from '../src/data/seed.js';
import { paraCsv } from '../src/lib/csv.ts';

const MIN = 60_000;
const OP1 = { base: 'OP1', centro: ['SUP'], esq: 4, dir: 4, inicio: 'sup', padrao: ['grupo', 'lado', 'posicao', 'item'], sep: '-', desativadas: {} };
const DG1 = { ...OP1, base: 'DG-M1', centro: ['SUP', 'SUB'], esq: 5, dir: 5 };

test('etiquetas seguem o padrão Benconsig (§4.1)', () => {
  assert.equal(montarCodigo(OP1, { lado: 'E', num: 2 }, 'HS'), 'OP1-E2-HS');
  assert.equal(montarCodigo(OP1, { papel: 'SUP' }, 'MN'), 'OP1-SUP-MN');
  assert.equal(montarCodigo(DG1, { lado: 'D', num: 5 }, 'PC'), 'DG-M1-D5-PC');
  assert.equal(montarCodigo(DG1, { papel: 'SUB' }, 'PC'), 'DG-M1-SUB-PC');
  assert.equal(montarCodigo(OP1, { lado: 'E', num: 2 }, 'MN', 2), 'OP1-E2-MN2');
  assert.equal(montarCodigo(OP1, { lado: 'E', num: 2 }), 'OP1-E2');
  assert.equal(codigoLocal('ALM', 'HS', 7), 'ALM-HS-007');
});

test('padrão de outro cliente: {grupo}-{posição}-{item} numera em sequência', () => {
  const L = { base: '3B', centro: [], esq: 3, dir: 4, padrao: ['grupo', 'posicao', 'item'], sep: '-' };
  assert.equal(montarCodigo(L, { lado: 'E', num: 2 }, 'HS'), '3B-02-HS');
  assert.equal(montarCodigo(L, { lado: 'D', num: 4 }, 'HS'), '3B-07-HS');
});

test('a Benconsig tem 69 posições (§4.2)', () => {
  const total = seedLayouts().reduce((n, L) => n + posicoesDaMesa(L).length, 0);
  assert.equal(total, 69);
});

test('baia 1 fica perto da porta nas mesas sem supervisor', () => {
  const L = { ...OP1, centro: [], esq: 3, dir: 3, inicio: 'porta' };
  const rows = linhasDaMesa(L);
  assert.equal(rows[rows.length - 1].esq.num, 1);
  assert.equal(linhasDaMesa(OP1)[0].esq.num, 1);
});

test('editor de espaços valida a mesa (RF38/39)', () => {
  assert.match(validarMesa({ ...OP1, base: 'OP6', itens: ['PC'], padrao: ['grupo', 'item'] }), /Posição/);
  assert.match(validarMesa({ ...OP1, base: 'OP1', itens: ['PC'] }, ['OP1']), /Já existe/);
  assert.equal(validarMesa({ ...OP1, base: 'OP6', itens: ['PC'] }, ['OP1']), '');
});

test('lerCodigo encontra baia e item a partir do texto', () => {
  const L = { ...OP1, id: 'OP1' };
  assert.deepEqual(lerCodigo('op1-e2-hs', [L]), { layoutId: 'OP1', pos: 'E2', item: 'HS', dup: 0 });
  assert.equal(lerCodigo('XX-1', [L]), null);
});

test('triagem: motivo obrigatório e alerta de marcação rápida (RF07/RF08b)', () => {
  assert.equal(passoOk({ st: 'feito' }), true);
  assert.equal(passoOk({ st: 'imposs', motivo: 'curto' }), false);
  assert.equal(passoOk({ st: 'imposs', motivo: 'não há outra baia livre' }), true);
  const t0 = 1_000_000;
  assert.ok(alertaTriagem([{ at: t0 }, { at: t0 + 300 }, { at: t0 + 600 }]));
  assert.equal(alertaTriagem([{ at: t0 }, { at: t0 + 30_000 }, { at: t0 + 60_000 }]), null);
});

test('prioridade é sim ou não (sem SLA)', () => {
  assert.equal(ehPrioritario({ tipoPrioritario: true }), true);
  assert.equal(ehPrioritario({ operadorParado: true }), true);
  assert.equal(ehPrioritario({}), false);
  const fila = [
    { id: 1, prioritario: false, criadoEm: 1 },
    { id: 2, prioritario: true, criadoEm: 5 },
    { id: 3, prioritario: true, criadoEm: 3 },
    { id: 4, prioritario: false, criadoEm: 0 }
  ].sort(ordemFila);
  assert.deepEqual(fila.map((c) => c.id), [3, 2, 4, 1]);
});

test('incidente geral: 3 chamados da mesma situação em 1 hora (RF09)', () => {
  const agora = 10 * 60 * MIN;
  const c = (id, min) => ({ id, sitId: 's1', status: 'Em Análise', criadoEm: agora - min * MIN });
  assert.equal(detectarIncidentes([c(1, 5), c(2, 10), c(3, 50)], { agora }).length, 1);
  assert.equal(detectarIncidentes([c(1, 5), c(2, 10), c(3, 90)], { agora }).length, 0);
});

test('reabertura só até 7 dias após concluir (RN07)', () => {
  const dia = 24 * 60 * MIN;
  const ch = { status: 'Concluído', hist: [{ status: 'Concluído', at: 0 }] };
  assert.equal(podeReabrir(ch, 6 * dia), true);
  assert.equal(podeReabrir(ch, 8 * dia), false);
});

test('ciclo de vida do item (§4) e descarte final (RN05)', () => {
  assert.equal(podeTransicionar('Novo', 'Em uso'), true);
  assert.equal(podeTransicionar('Novo', 'Quebrado'), false);
  assert.equal(podeTransicionar('Quebrado', 'Descartado'), true);
  assert.equal(podeTransicionar('Descartado', 'Novo'), false);
});

test('sugestão de compra considera mínimo e consumo (RF27)', () => {
  assert.deepEqual(sugestaoCompra({ disponiveis: 3, minimo: 5, consumo90d: 6 }), { mensal: 2, sugerir: 4 });
  assert.equal(sugestaoCompra({ disponiveis: 10, minimo: 2, consumo90d: 3 }).sugerir, 0);
});

test('contraste WCAG (RF37)', () => {
  assert.equal(contraste('#000000', '#FFFFFF'), 21);
  assert.ok(nivelContraste(contraste('#0B3A82', '#FFFFFF')).ok);
  assert.equal(nivelContraste(contraste('#F5B800', '#FFFFFF')).ok, false);
});

test('seed é determinístico e consistente', () => {
  const a = seed(1_800_000_000_000);
  const b = seed(1_800_000_000_000);
  assert.equal(JSON.stringify(a.chamados), JSON.stringify(b.chamados));
  const ids = new Set(a.itens.map((i) => i.id));
  assert.equal(ids.size, a.itens.length, 'IDs internos únicos');
  for (const c of a.chamados) for (const i of c.itens) assert.ok(ids.has(i.assetId));
});

test('CSV abre no Excel em português', () => {
  const s = paraCsv(['a', 'b'], [['x;y', 'z"w']]);
  assert.ok(s.startsWith('﻿'));
  assert.ok(s.includes('"x;y";"z""w"'));
});
