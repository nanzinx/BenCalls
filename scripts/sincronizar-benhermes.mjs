#!/usr/bin/env node
// Traz a lógica do WhatsApp das Baias do BenHermes para o BenCalls, sem mudar uma linha das regras.
//
//   node scripts/sincronizar-benhermes.mjs ../BENHERMES
//
// - Copia os arquivos puros (tipos e utils) para src/lib/benhermes/.
// - Copia os testes do BenHermes para tests/benhermes/ (rodam aqui com um "vitest" mínimo).
// - Ajusta só os imports: extensão .ts e "import type" (o BenCalls usa verbatimModuleSyntax e o Node
//   roda TypeScript tirando os tipos, então um tipo importado sem "type" quebraria).
// O mesmo mapa (.json, versão 3) vale nos dois sistemas.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origem = resolve(process.argv[2] || '../BENHERMES');
if (!existsSync(join(origem, 'src/types/whatsapp.ts'))) {
  console.error(`Não achei o BenHermes em ${origem}. Use: node scripts/sincronizar-benhermes.mjs <pasta do BenHermes>`);
  process.exit(1);
}

const UTILS = ['mapaMesas', 'whatsappBaias', 'celulares', 'whatsappAlertas', 'whatsappHistorico', 'whatsappManutencao'];
const TESTES = ['mapaMesas', 'whatsappBaias', 'celulares', 'whatsappAlertas', 'whatsappHistorico', 'whatsappManutencao', 'whatsappSupervisor'];

let commit = 'desconhecido';
try { commit = execSync('git rev-parse --short HEAD', { cwd: origem }).toString().trim(); } catch { /* sem git */ }

const destLib = join(raiz, 'src/lib/benhermes');
const destTestes = join(raiz, 'tests/benhermes');
mkdirSync(destLib, { recursive: true });
mkdirSync(destTestes, { recursive: true });

// Nomes que cada módulo exporta só como tipo (export type / export interface).
const ler = (p) => readFileSync(p, 'utf8');
const fontes = {
  whatsapp: ler(join(origem, 'src/types/whatsapp.ts')),
  calendario: ler(join(origem, 'src/utils/calendario.ts')),
  ...Object.fromEntries(UTILS.map((u) => [u, ler(join(origem, `src/utils/${u}.ts`))]))
};
const tiposDe = (txt) => new Set([...txt.matchAll(/export\s+(?:type|interface)\s+(\w+)/g)].map((m) => m[1]));
const tipos = Object.fromEntries(Object.entries(fontes).map(([k, v]) => [k, tiposDe(v)]));

/** Reescreve os imports de um arquivo. `caminho(mod)` diz para onde aponta cada módulo. */
function ajustarImports(txt, caminho) {
  return txt.replace(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)';/g, (todo, soTipo, lista, de) => {
    if (de === 'vitest') return `import { describe, expect, it } from './vitest.ts';`;
    if (!de.startsWith('.')) return todo;
    const mod = de.split('/').pop();
    const alvo = caminho(mod);
    if (!alvo) return todo;
    const nomes = lista.split(',').map((s) => s.trim()).filter(Boolean);
    const ehTipo = (n) => soTipo || n.startsWith('type ') || tipos[mod]?.has(n.replace(/^type\s+/, '').split(/\s+as\s+/)[0]);
    const t = nomes.filter(ehTipo).map((n) => n.replace(/^type\s+/, ''));
    const v = nomes.filter((n) => !ehTipo(n));
    const out = [];
    if (t.length) out.push(`import type { ${t.join(', ')} } from '${alvo}';`);
    if (v.length) out.push(`import { ${v.join(', ')} } from '${alvo}';`);
    return out.join('\n');
  });
}

const cabecalho = (arquivo) =>
  `// Copiado do BenHermes (${arquivo}, commit ${commit}) por scripts/sincronizar-benhermes.mjs.\n` +
  '// Não edite aqui: mude no BenHermes e rode o script de novo, para as regras continuarem iguais nos dois.\n';

// Tipos
writeFileSync(join(destLib, 'whatsapp.ts'), cabecalho('src/types/whatsapp.ts') + fontes.whatsapp);

// calendario: só o normalizarNome (o resto depende do xlsx e não é usado aqui)
const normalizar = /export const normalizarNome[\s\S]*?\n};\n/.exec(fontes.calendario);
if (!normalizar) throw new Error('normalizarNome não encontrado em calendario.ts');
writeFileSync(join(destLib, 'calendario.ts'), cabecalho('src/utils/calendario.ts (só normalizarNome)') + '\n' + normalizar[0]);

const paraLib = (mod) => (mod === 'whatsapp' ? './whatsapp.ts' : mod === 'calendario' || UTILS.includes(mod) ? `./${mod}.ts` : null);
for (const u of UTILS) {
  writeFileSync(join(destLib, `${u}.ts`), cabecalho(`src/utils/${u}.ts`) + ajustarImports(fontes[u], paraLib));
}

const paraTeste = (mod) => {
  const l = paraLib(mod);
  return l ? `../../src/lib/benhermes/${l.slice(2)}` : null;
};
for (const t of TESTES) {
  const txt = ler(join(origem, `src/utils/${t}.test.ts`));
  writeFileSync(join(destTestes, `${t}.test.ts`), cabecalho(`src/utils/${t}.test.ts`) + ajustarImports(txt, paraTeste));
}

writeFileSync(join(destLib, 'versao.ts'), `${cabecalho('git rev-parse HEAD')}export const VERSAO_BENHERMES = '${commit}';\n`);
console.log(`BenHermes ${commit}: ${UTILS.length} módulos e ${TESTES.length} testes sincronizados.`);
