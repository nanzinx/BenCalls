// Garante que classes de componente montadas dinamicamente (`note-${tipo}`) estejam no safelist
// do Tailwind; senão elas somem do CSS de produção sem nenhum erro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import config from '../tailwind.config.ts';

function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(jsx|tsx)$/.test(n) ? [p] : [];
  });
}

test('classes dinâmicas de componente estão no safelist do Tailwind', () => {
  const prefixos = new Set();
  for (const f of arquivos('src')) {
    const t = readFileSync(f, 'utf8');
    for (const m of t.matchAll(/className=\{`([^`]*)`\}/g)) {
      for (const p of m[1].matchAll(/(?:^|\s)([a-z]+)-\$\{/g)) prefixos.add(p[1]);
    }
  }
  assert.ok(prefixos.size > 0);
  const safelist = config.safelist.map(String);
  for (const p of prefixos) {
    assert.ok(safelist.some((c) => c.startsWith(`${p}-`)), `faltou "${p}-…" no safelist de tailwind.config.ts`);
  }
});
