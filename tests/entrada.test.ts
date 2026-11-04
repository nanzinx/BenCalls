import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saudacao, primeiroNome, deveMostrarEntrada, valorNaContagem, diaDe, registrarErro, MAX_TENTATIVAS, BLOQUEIO_MS } from '../src/lib/entrada.ts';

test('saudação pela hora de Brasília', () => {
  assert.equal(saudacao(new Date('2026-11-04T11:00:00Z')), 'Bom dia'); // 08:00 em Brasília
  assert.equal(saudacao(new Date('2026-11-04T17:00:00Z')), 'Boa tarde'); // 14:00
  assert.equal(saudacao(new Date('2026-11-04T23:30:00Z')), 'Boa noite'); // 20:30
  assert.equal(diaDe(new Date('2026-11-05T01:00:00Z')), '2026-11-04'); // ainda é dia 4 em Brasília
});

test('primeiro nome formatado', () => {
  assert.equal(primeiroNome('  CARLA souza '), 'Carla');
  assert.equal(primeiroNome(''), null);
});

test('entrada aparece uma vez por dia e sempre depois do login', () => {
  assert.equal(deveMostrarEntrada({ vistoEm: '2026-11-04', hoje: '2026-11-04', acabouDeEntrar: false }), false);
  assert.equal(deveMostrarEntrada({ vistoEm: '2026-11-03', hoje: '2026-11-04', acabouDeEntrar: false }), true);
  assert.equal(deveMostrarEntrada({ vistoEm: '2026-11-04', hoje: '2026-11-04', acabouDeEntrar: true }), true);
});

test('contagem vai de 0 ao valor, desacelerando', () => {
  assert.equal(valorNaContagem(100, 0, 650), 0);
  assert.equal(valorNaContagem(100, 650, 650), 100);
  assert.ok(valorNaContagem(100, 325, 650) > 50);
});

test('login bloqueia depois de 5 senhas erradas', () => {
  let t = { erros: 0, bloqueadoAte: 0 };
  for (let i = 0; i < MAX_TENTATIVAS - 1; i++) t = registrarErro(t, 1000);
  assert.equal(t.bloqueadoAte, 0);
  t = registrarErro(t, 1000);
  assert.equal(t.bloqueadoAte, 1000 + BLOQUEIO_MS);
});
