// Regras da entrada animada (components/Entrada.tsx), no mesmo modelo do BenHeimdall e do
// BenURA: saudação pela hora de Brasília, primeiro nome de quem entrou, quando mostrar (uma
// vez por dia em cada navegador e sempre logo depois do login) e a contagem dos números.

const FUSO = 'America/Sao_Paulo';
export const CHAVE_ENTRADA = 'bencalls-entrada-vista-em';
const CHAVE_LOGIN = 'bencalls-acabou-de-entrar';

const horaEm = (data: Date) =>
  Number(new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: 'numeric', hourCycle: 'h23' }).format(data));

/** "2026-11-04" no fuso da operação. */
export const diaDe = (data: Date): string => new Intl.DateTimeFormat('sv-SE', { timeZone: FUSO }).format(data);

export function saudacao(agora: Date = new Date()): 'Bom dia' | 'Boa tarde' | 'Boa noite' {
  const h = horaEm(agora);
  return h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite';
}

export function primeiroNome(nome: string | null | undefined): string | null {
  const p = String(nome ?? '').trim().split(/\s+/)[0];
  return p ? p[0]!.toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR') : null;
}

export function deveMostrarEntrada(o: { vistoEm: string | null; hoje: string; acabouDeEntrar: boolean }): boolean {
  return o.acabouDeEntrar || o.vistoEm !== o.hoje;
}

/** Conta de 0 até `ate` em `duracaoMs` (rápido no começo, devagar no fim). */
export function valorNaContagem(ate: number, passadoMs: number, duracaoMs: number): number {
  const p = Math.min(1, Math.max(0, passadoMs / duracaoMs));
  return Math.round(ate * (1 - (1 - p) ** 3));
}

// localStorage/sessionStorage podem não existir (janela anônima, bloqueados): sem eles, mostra e segue.
function ler(armazem: () => Storage, chave: string): string | null {
  try {
    return armazem().getItem(chave);
  } catch {
    return null;
  }
}
function gravar(armazem: () => Storage, chave: string, valor: string | null): void {
  try {
    if (valor === null) armazem().removeItem(chave);
    else armazem().setItem(chave, valor);
  } catch {
    /* sem armazenamento: aparece de novo na próxima vez */
  }
}

export const lerVistoEm = () => ler(() => localStorage, CHAVE_ENTRADA);
export const marcarVisto = (hoje: string) => gravar(() => localStorage, CHAVE_ENTRADA, hoje);
export const marcarLogin = () => gravar(() => sessionStorage, CHAVE_LOGIN, '1');
export const loginRecente = () => ler(() => sessionStorage, CHAVE_LOGIN) === '1';
export const limparLogin = () => gravar(() => sessionStorage, CHAVE_LOGIN, null);

// ---------- proteção do login (demo): 5 senhas erradas bloqueiam por 5 minutos ----------
const CHAVE_TENTATIVAS = 'bencalls-tentativas';
export const MAX_TENTATIVAS = 5;
export const BLOQUEIO_MS = 5 * 60_000;

export interface Tentativas { erros: number; bloqueadoAte: number }

export function registrarErro(t: Tentativas, agora: number): Tentativas {
  const erros = t.erros + 1;
  return erros >= MAX_TENTATIVAS ? { erros: 0, bloqueadoAte: agora + BLOQUEIO_MS } : { erros, bloqueadoAte: t.bloqueadoAte };
}

export function lerTentativas(): Tentativas {
  try {
    const t = JSON.parse(ler(() => localStorage, CHAVE_TENTATIVAS) || 'null');
    if (t && typeof t.erros === 'number') return t;
  } catch {
    /* ignora */
  }
  return { erros: 0, bloqueadoAte: 0 };
}
export const gravarTentativas = (t: Tentativas | null) => gravar(() => localStorage, CHAVE_TENTATIVAS, t ? JSON.stringify(t) : null);

// ---------- sessão por inatividade ----------
export const INATIVIDADE_MS = 30 * 60_000;
const CHAVE_ATIVIDADE = 'bencalls-atividade';
export const marcarAtividade = (agora = Date.now()) => gravar(() => localStorage, CHAVE_ATIVIDADE, String(agora));
export function inativo(agora = Date.now()): boolean {
  const v = Number(ler(() => localStorage, CHAVE_ATIVIDADE) || 0);
  return v > 0 && agora - v > INATIVIDADE_MS;
}
