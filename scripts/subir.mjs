#!/usr/bin/env node
// Um comando só para subir o BenCalls no pm2 (Windows, Linux ou Mac):
//
//   npm run subir          instala o que faltar, compila, sobe (ou recarrega) no pm2 e confere se está no ar
//   npm run subir:ngrok    faz o mesmo e abre o túnel do ngrok, já com o IP real dos visitantes
//
// Para acompanhar e parar: npm run pm2:logs · npm run pm2:parar
// Este arquivo não usa nenhuma dependência: roda antes mesmo do "npm install".
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, statSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const comNgrok = args.includes('--ngrok');
const argsDoNgrok = args.filter((a) => a !== '--ngrok');
const WINDOWS = process.platform === 'win32';

const passo = (n, txt) => console.log(`\n[${n}] ${txt}`);
const falhar = (txt) => { console.error(`\n✖ ${txt}`); process.exit(1); };

/** Roda um arquivo .js com o mesmo Node (sem depender de .cmd no Windows). */
function node(arquivo, argumentos, env = process.env) {
  const r = spawnSync(process.execPath, [arquivo, ...argumentos], { cwd: RAIZ, stdio: 'inherit', env });
  return r.status === 0;
}

// ---------------------------------------------------------------- 0) Node
const [maior, menor] = process.versions.node.split('.').map(Number);
if (maior < 22 || (maior === 22 && menor < 18)) falhar(`O BenCalls precisa do Node 22.18 ou mais novo (este é o ${process.versions.node}). Instale a versão LTS atual.`);

// ---------------------------------------------------------------- 1) .env e dependências
passo(1, 'Conferindo a configuração e as dependências');
if (!existsSync(join(RAIZ, '.env')) && existsSync(join(RAIZ, '.env.example'))) {
  copyFileSync(join(RAIZ, '.env.example'), join(RAIZ, '.env'));
  console.log('  .env criado a partir do .env.example (ajuste depois, se precisar).');
}
try { process.loadEnvFile(join(RAIZ, '.env')); } catch { /* sem .env */ }
const instalado = join(RAIZ, 'node_modules', '.package-lock.json');
const trava = join(RAIZ, 'package-lock.json');
const precisaInstalar = !existsSync(instalado) || !existsSync(join(RAIZ, 'node_modules', 'vite')) || statSync(trava).mtimeMs > statSync(instalado).mtimeMs;
if (precisaInstalar) {
  console.log('  Instalando as dependências (só na primeira vez ou quando mudam)…');
  const npmCli = process.env.npm_execpath; // quando chamado por "npm run", aponta para o npm-cli.js
  const ok = npmCli && /npm-cli\.js$/.test(npmCli)
    ? node(npmCli, ['ci', '--include=dev', '--no-audit', '--no-fund'])
    : spawnSync('npm', ['ci', '--include=dev', '--no-audit', '--no-fund'], { cwd: RAIZ, stdio: 'inherit', shell: WINDOWS }).status === 0;
  if (!ok) falhar('Não deu para instalar as dependências (veja o erro acima).');
} else console.log('  Dependências em dia.');

// ---------------------------------------------------------------- 2) build
passo(2, 'Compilando o site');
if (!node(join(RAIZ, 'node_modules', 'vite', 'bin', 'vite.js'), ['build'])) falhar('A compilação falhou (veja o erro acima).');

// ---------------------------------------------------------------- 3) pm2
passo(3, 'Subindo no pm2');
const PORTA = process.env.PORT || '8080';
// Atrás do ngrok a conexão chega do próprio PC: o IP real do visitante vem no X-Forwarded-For.
const env = comNgrok ? { ...process.env, CONFIAR_PROXY: '1' } : process.env;
const pm2 = join(RAIZ, 'node_modules', 'pm2', 'bin', 'pm2');
if (!node(pm2, ['startOrReload', 'ecosystem.config.cjs', '--update-env'], env)) falhar('O pm2 não conseguiu subir o site (veja o erro acima).');

// ---------------------------------------------------------------- 4) está no ar?
passo(4, 'Conferindo se o site respondeu');
let saude = null;
for (let i = 0; i < 30 && !saude; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORTA}/healthz`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) saude = await r.json();
  } catch { /* ainda subindo */ }
  if (!saude) await new Promise((ok) => setTimeout(ok, 1000));
}
if (!saude) falhar(`O site não respondeu em http://localhost:${PORTA}. Veja o motivo com: npm run pm2:logs`);
console.log(`  ✔ BenCalls no ar em http://localhost:${PORTA}`);
console.log('  Só entram os IPs de server/ips-liberados.txt (e este computador). Outros: IPS_LIBERADOS no .env.');
console.log('  Acompanhar: npm run pm2:logs · Parar: npm run pm2:parar');

// ---------------------------------------------------------------- 5) ngrok (opcional)
if (!comNgrok) process.exit(0);
passo(5, 'Abrindo o túnel do ngrok (Ctrl+C fecha o túnel; o site continua no pm2)');
console.log('  O endereço público aparece abaixo, em "Forwarding".');
console.log('  Atenção: os dados ainda são de demonstração e ficam no navegador de cada pessoa.\n');
const semNgrok = () => falhar(
  'Não achei o ngrok neste computador. Instale em https://ngrok.com/download, rode uma vez\n' +
  '  "ngrok config add-authtoken <seu token>" e repita o comando. O site já está no ar no pm2.'
);
const tunel = spawn('ngrok', ['http', PORTA, ...argsDoNgrok], { cwd: RAIZ, stdio: 'inherit', shell: WINDOWS });
tunel.on('error', semNgrok);
tunel.on('exit', (codigo) => {
  if (codigo === 127 || (WINDOWS && codigo === 1 && !tunelAbriu)) return semNgrok();
  console.log('\nTúnel fechado. O site continua no pm2 (npm run pm2:parar para desligar).');
  process.exit(codigo ?? 0);
});
let tunelAbriu = false;
setTimeout(() => { tunelAbriu = true; }, 3000).unref();
