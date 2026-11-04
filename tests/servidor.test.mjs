import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { carregar, criarServidor, resolverRota, permitir } from '../server/servidor.mjs';

let dir, srv, base;
before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'bencalls-dist-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>BenCalls</title>' + 'x'.repeat(3000));
  writeFileSync(join(dir, 'assets', 'app-abc123.js'), 'console.log(1);' + ' '.repeat(3000));
  writeFileSync(join(dir, '..', 'segredo.txt'), 'não pode vazar');
  srv = criarServidor(carregar(dir));
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${srv.address().port}`;
});
after(() => { srv.close(); rmSync(dir, { recursive: true, force: true }); rmSync(join(dir, '..', 'segredo.txt'), { force: true }); });

test('cabeçalhos de segurança em toda resposta', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(r.headers.get('content-security-policy'), /script-src 'self'(;|$)/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.match(r.headers.get('strict-transport-security'), /max-age=31536000/);
  assert.equal(r.headers.get('cache-control'), 'no-cache');
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('rotas da SPA caem no index.html; arquivo inexistente é 404', async () => {
  assert.equal((await fetch(base + '/painel?ch=12')).status, 200);
  assert.equal((await fetch(base + '/assets/nao-existe.js')).status, 404);
});

test('não sai da pasta do build (path traversal)', async () => {
  for (const u of ['/../segredo.txt', '/%2e%2e/segredo.txt', '/assets/..%2f..%2fsegredo.txt', '/..%5csegredo.txt']) {
    const r = await fetch(base + u);
    const t = await r.text();
    assert.ok(!t.includes('não pode vazar'), u);
  }
  assert.equal(resolverRota(new Map([['/index.html', {}]]), '/a%00b.js'), null);
});

test('assets com hash ficam em cache imutável, comprimidos e com ETag', async () => {
  const r = await fetch(base + '/assets/app-abc123.js', { headers: { 'accept-encoding': 'br' } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control'), /immutable/);
  assert.equal(r.headers.get('content-encoding'), 'br');
  const r2 = await fetch(base + '/assets/app-abc123.js', { headers: { 'if-none-match': r.headers.get('etag') } });
  assert.equal(r2.status, 304);
});

test('só GET/HEAD; URL longa vira 414; healthz responde', async () => {
  const r = await fetch(base + '/', { method: 'POST', body: 'x' });
  assert.equal(r.status, 405);
  assert.equal(r.headers.get('allow'), 'GET, HEAD');
  assert.equal((await fetch(base + '/' + 'a'.repeat(2100))).status, 414);
  const h = await fetch(base + '/healthz');
  assert.equal(h.status, 200);
  assert.equal((await h.json()).ok, true);
});

test('limite de requisições por IP', () => {
  for (let i = 0; i < 3; i++) assert.equal(permitir('1.2.3.4', 1000, 3), true);
  assert.equal(permitir('1.2.3.4', 1000, 3), false);
  assert.equal(permitir('1.2.3.4', 61_000, 3), true);
});
