import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerIp, lerRegra, criarFiltro, carregarRegras } from '../server/bloqueio.mjs';

test('lê IPv4, IPv6 abreviado e IPv4 mapeado em IPv6', () => {
  assert.deepEqual(lerIp('201.93.163.133'), { v: 4, n: 0xc95da385n });
  assert.equal(lerIp('::ffff:201.93.163.133').v, 4);
  assert.equal(lerIp('::ffff:201.93.163.133').n, lerIp('201.93.163.133').n);
  assert.equal(lerIp('2804:431:80f7:7700::1').v, 6);
  assert.equal(lerIp('fe80::1%eth0').v, 6);
  assert.equal(lerIp('999.1.1.1'), null);
  assert.equal(lerIp('2804::431::1'), null);
});

test('/48 compara só os 3 primeiros grupos', () => {
  assert.equal(lerRegra('2804:431:80f7:7700::/48').rede, lerRegra('2804:431:80f7::/48').rede);
  assert.equal(lerRegra('2804:1b3:a5e7:c3c7::/48').rede, lerRegra('2804:1b3:a5e7:8e38::/48').rede);
  assert.equal(lerRegra('1.2.3.4/33'), null);
});

test('as regras do arquivo bloqueiam os IPs pedidos e mais nada', () => {
  const f = carregarRegras(undefined, '');
  assert.equal(f.invalidas.length, 0);
  for (const ip of ['201.93.163.133', '201.93.159.169', '::ffff:201.93.159.169', '2804:431:80f7:7700::1', '2804:431:80f7:ffff:1:2:3:4',
    '2804:1b3:a5e7:c3c7::abcd', '2804:1b3:a5e7:2c83:1::1', '2804:1b3:a5e7:8e38::9', '2804:1b3:a5e7:1234::1']) {
    assert.ok(f.bloqueado(ip), `deveria bloquear ${ip}`);
  }
  for (const ip of ['201.93.163.134', '201.93.159.168', '127.0.0.1', '::1', '2804:431:80f8::1', '2804:1b3:a5e8::1', '2804:1b4:a5e7::1']) {
    assert.equal(f.bloqueado(ip), null, `não deveria bloquear ${ip}`);
  }
});

test('IPS_BLOQUEADOS soma regras às do arquivo', () => {
  const f = carregarRegras(undefined, '10.0.0.0/8, 2001:db8::/32');
  assert.ok(f.bloqueado('10.20.30.40'));
  assert.ok(f.bloqueado('2001:db8:1::1'));
  assert.ok(f.bloqueado('201.93.163.133'));
});

test('regra inválida é ignorada e informada', () => {
  const f = criarFiltro(['1.2.3.4', 'isso-nao-e-ip', '::1/200']);
  assert.deepEqual(f.invalidas, ['isso-nao-e-ip', '::1/200']);
  assert.ok(f.bloqueado('1.2.3.4'));
});

test('middleware do Vite responde 403 para IP bloqueado e deixa os outros passarem', async () => {
  const { middlewareBloqueio } = await import('../server/bloqueio.mjs');
  const mw = middlewareBloqueio(criarFiltro(['201.93.163.133']));
  const chamar = (ip) => {
    const res = { statusCode: 200, cab: {}, setHeader(k, v) { this.cab[k] = v; }, end(t) { this.corpo = t; } };
    let passou = false;
    mw({ headers: {}, socket: { remoteAddress: ip } }, res, () => { passou = true; });
    return { res, passou };
  };
  const b = chamar('::ffff:201.93.163.133');
  assert.equal(b.res.statusCode, 403);
  assert.equal(b.passou, false);
  assert.equal(chamar('127.0.0.1').passou, true);
});
