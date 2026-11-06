import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paraVoce, motivoParaPessoa } from '../src/lib/notificacoes.ts';
import type { ChamadoNotificavel } from '../src/lib/notificacoes.ts';

const diego = { id: 'u3', depto: 'TI', perfil: 'ti', acessos: ['ASC'] };
const bruna = { id: 'u4', depto: 'TI', perfil: 'ti', acessos: ['ASC'] };
const paula = { id: 'u5', depto: 'RH', perfil: 'rh', acessos: ['RH'] };
const carla = { id: 'u1', depto: 'Operacional', perfil: 'supervisor', acessos: ['RC'] };
const ch = (o: Partial<ChamadoNotificavel>): ChamadoNotificavel => ({ id: 1, status: 'Em Análise', depto: 'TI', tecnicoId: null, remetenteId: 'u1', criadoEm: 100, ...o });

test('novo na fila do TI chega para todo o TI, não para quem abriu nem para outros departamentos', () => {
  const c = ch({});
  assert.equal(motivoParaPessoa(c, diego), 'fila');
  assert.equal(motivoParaPessoa(c, bruna), 'fila');
  assert.equal(motivoParaPessoa(c, carla), null);
  assert.equal(motivoParaPessoa(c, paula), null);
  assert.equal(motivoParaPessoa(ch({ remetenteId: 'u3' }), diego), null);
});

test('encaminhado chega só para o técnico escolhido', () => {
  const c = ch({ tecnicoId: 'u4', direcionadoEm: 200, motivoDirecionamento: 'encaminhado' });
  assert.equal(motivoParaPessoa(c, bruna), 'encaminhado');
  assert.equal(motivoParaPessoa(c, diego), null);
});

test('solicitação para o RH chega para o RH', () => {
  assert.equal(motivoParaPessoa(ch({ depto: 'RH' }), paula), 'fila');
});

test('aguardando confirmação e encerrados não notificam', () => {
  assert.equal(motivoParaPessoa(ch({ status: 'Aguardando Consenso' }), diego), null);
  assert.equal(motivoParaPessoa(ch({ status: 'Concluído' }), diego), null);
});

test('o que a pessoa já viu sai da lista e volta se for direcionado de novo', () => {
  const c = ch({ id: 7, tecnicoId: 'u3', direcionadoEm: 300, direcionadoPor: 'u4' });
  assert.equal(paraVoce([c], diego, {}).length, 1);
  assert.equal(paraVoce([c], diego, { 7: 300 }).length, 0);
  const voltou = { ...c, direcionadoEm: 500, motivoDirecionamento: 'voltou' as const, direcionadoPor: 'u1' };
  const r = paraVoce([voltou], diego, { 7: 300 });
  assert.equal(r.length, 1);
  assert.equal(r[0].motivo, 'voltou');
});

test('não avisa a pessoa sobre o que ela mesma fez (ex.: assumir)', () => {
  assert.equal(paraVoce([ch({ tecnicoId: 'u3', direcionadoEm: 300, direcionadoPor: 'u3' })], diego).length, 0);
});

test('mais recentes primeiro', () => {
  const r = paraVoce([ch({ id: 1, criadoEm: 100 }), ch({ id: 2, criadoEm: 300 }), ch({ id: 3, criadoEm: 200 })], diego);
  assert.deepEqual(r.map((x) => x.chamado.id), [2, 3, 1]);
});
