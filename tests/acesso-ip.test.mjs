import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerIp, lerRegra, criarFiltro, carregarRegras } from '../server/acesso-ip.mjs';

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

test('só os IPs do arquivo entram (os mesmos do BenHermes), mais o próprio servidor', () => {
  const f = carregarRegras(undefined, '', true);
  assert.equal(f.invalidas.length, 0);
  for (const ip of ['201.93.163.133', '201.93.159.169', '::ffff:201.93.159.169', '2804:431:80f7:7700::1', '2804:431:80f7:ffff:1:2:3:4',
    '2804:1b3:a5e7:c3c7::abcd', '2804:1b3:a5e7:2c83:1::1', '2804:1b3:a5e7:8e38::9', '2804:1b3:a5e7:1234::1', '127.0.0.1', '::1', '::ffff:127.0.0.1']) {
    assert.equal(f.bloqueado(ip), false, `deveria liberar ${ip}`);
    assert.ok(f.liberado(ip));
  }
  for (const ip of ['201.93.163.134', '201.93.159.168', '2804:431:80f8::1', '2804:1b3:a5e8::1', '2804:1b4:a5e7::1', '8.8.8.8', '192.168.0.10', '172.17.0.1', '', 'lixo']) {
    assert.equal(f.bloqueado(ip), true, `deveria barrar ${ip}`);
  }
});

test('IPS_LIBERADOS soma regras às do arquivo', () => {
  const f = carregarRegras(undefined, '10.0.0.0/8, 2001:db8::/32', true);
  assert.equal(f.bloqueado('10.20.30.40'), false);
  assert.equal(f.bloqueado('2001:db8:1::1'), false);
  assert.equal(f.bloqueado('201.93.163.133'), false);
  assert.equal(f.bloqueado('11.0.0.1'), true);
});

test('lista vazia não deixa ninguém entrar; RESTRINGIR_IPS=0 desliga', () => {
  assert.equal(criarFiltro([]).bloqueado('201.93.163.133'), true);
  assert.equal(criarFiltro([], { restringir: false }).bloqueado('8.8.8.8'), false);
  assert.equal(carregarRegras(undefined, '', false).bloqueado('8.8.8.8'), false);
});

test('regra inválida é ignorada e informada', () => {
  const f = criarFiltro(['1.2.3.4', 'isso-nao-e-ip', '::1/200']);
  assert.deepEqual(f.invalidas, ['isso-nao-e-ip', '::1/200']);
  assert.equal(f.bloqueado('1.2.3.4'), false);
  assert.equal(f.bloqueado('1.2.3.5'), true);
});

test('middleware do Vite responde 403 para IP fora da lista e deixa os liberados passarem', async () => {
  const { middlewareBloqueio } = await import('../server/acesso-ip.mjs');
  const mw = middlewareBloqueio(criarFiltro(['201.93.163.133', '127.0.0.1']));
  const chamar = (ip) => {
    const res = { statusCode: 200, cab: {}, setHeader(k, v) { this.cab[k] = v; }, end(t) { this.corpo = t; } };
    let passou = false;
    mw({ headers: {}, socket: { remoteAddress: ip } }, res, () => { passou = true; });
    return { res, passou };
  };
  assert.equal(chamar('::ffff:201.93.163.133').passou, true);
  assert.equal(chamar('127.0.0.1').passou, true);
  const b = chamar('189.10.20.30');
  assert.equal(b.res.statusCode, 403);
  assert.equal(b.passou, false);
});

test('atrás do ngrok (CONFIAR_PROXY): vale o IP real do X-Forwarded-For, só em conexão local', async () => {
  const { ipDoCliente } = await import('../server/acesso-ip.mjs');
  const req = (remoto, headers = {}) => ({ socket: { remoteAddress: remoto }, headers });
  const proxy = { proxy: true };
  // visitante do túnel: conexão local + cabeçalho → o IP real (o último, que o túnel acrescentou)
  assert.equal(ipDoCliente(req('127.0.0.1', { 'x-forwarded-for': '8.8.8.8' }), proxy), '8.8.8.8');
  assert.equal(ipDoCliente(req('::ffff:127.0.0.1', { 'x-forwarded-for': '201.93.163.133, 8.8.8.8' }), proxy), '8.8.8.8');
  assert.equal(ipDoCliente(req('::1', { 'x-forwarded-for': '2804:431:80f7:7700::1' }), proxy), '2804:431:80f7:7700::1');
  // a própria máquina (sem cabeçalho) continua local
  assert.equal(ipDoCliente(req('127.0.0.1'), proxy), '127.0.0.1');
  // de fora, o cabeçalho não vale (qualquer um poderia inventar um IP liberado)
  assert.equal(ipDoCliente(req('189.10.20.30', { 'x-forwarded-for': '201.93.163.133' }), proxy), '189.10.20.30');
  // sem a opção ligada, o cabeçalho é ignorado
  assert.equal(ipDoCliente(req('127.0.0.1', { 'x-forwarded-for': '8.8.8.8' })), '127.0.0.1');
  // Cloudflare continua igual
  assert.equal(ipDoCliente(req('127.0.0.1', { 'cf-connecting-ip': '201.93.163.133' }), { cloudflare: true }), '201.93.163.133');
});
