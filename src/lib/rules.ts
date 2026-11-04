// Regras de negócio puras: status, SLA, prioridade, triagem, estoque.
import { MIN, DIA } from './format.ts';
import type { ChamadoBase, Historico, Prioridade, RegistroTriagem, StatusChamado, StatusItem, LocalFora } from './tipos.ts';

export const STATUS: StatusChamado[] = ['Em Análise', 'Pendente', 'Em Execução', 'Aguardando Consenso', 'Concluído', 'Cancelado', 'Negado'];
export const ABERTOS: StatusChamado[] = ['Em Análise', 'Pendente', 'Em Execução', 'Aguardando Consenso'];
export const FINAIS: StatusChamado[] = ['Concluído', 'Cancelado', 'Negado'];
/** O relógio do SLA só corre enquanto o chamado depende do TI. */
export const SLA_CORRE: StatusChamado[] = ['Em Análise', 'Em Execução'];

export const PRIORIDADES: Prioridade[] = ['Crítica', 'Alta', 'Média', 'Baixa'];
export const SLA_POR_PRIORIDADE: Record<Prioridade, number> = { Crítica: 60, Alta: 120, Média: 240, Baixa: 480 };

export const CAUSAS = ['Desgaste natural', 'Defeito de fábrica', 'Problema da baia', 'Mau uso', 'Sem dano físico'];

/** RF12: prioridade automática por impacto. Operador parado sobe para no mínimo Alta. */
export function prioridadePorImpacto(prioBase: Prioridade, operadorParado: boolean): Prioridade {
  if (!operadorParado) return prioBase;
  const i = Math.min(PRIORIDADES.indexOf(prioBase), PRIORIDADES.indexOf('Alta'));
  return PRIORIDADES[Math.max(0, i)];
}

export function slaDaPrioridade(prio: Prioridade, slaSub?: number): number {
  const p = SLA_POR_PRIORIDADE[prio] ?? 240;
  return slaSub ? Math.min(slaSub, p) : p;
}

/**
 * Minutos de SLA consumidos: soma só os intervalos em que o status estava
 * em SLA_CORRE (Pendente e Aguardando Consenso pausam o relógio).
 */
export function minutosConsumidos(hist: Historico[], agora: number = Date.now()): number {
  let total = 0;
  for (let i = 0; i < hist.length; i++) {
    const h = hist[i];
    const fim = i + 1 < hist.length ? hist[i + 1].at : agora;
    if (SLA_CORRE.includes(h.status)) total += Math.max(0, fim - h.at);
  }
  return total / MIN;
}

/** Situação do SLA de um chamado. */
export type NivelSla = 'ok' | 'alerta' | 'estourado';
export interface SlaInfo { usados: number; resta: number; pausado: boolean; finalizado: boolean; nivel: NivelSla; pct: number }

export function slaInfo(ch: ChamadoBase, agora: number = Date.now()): SlaInfo {
  const usados = minutosConsumidos(ch.hist, agora);
  const resta = Math.round(ch.slaMin - usados);
  const pausado = !SLA_CORRE.includes(ch.status);
  const finalizado = FINAIS.includes(ch.status);
  let nivel: NivelSla = 'ok';
  if (resta < 0) nivel = 'estourado';
  else if (resta <= Math.max(10, ch.slaMin * 0.25)) nivel = 'alerta';
  return { usados, resta, pausado, finalizado, nivel, pct: Math.min(100, Math.max(0, (usados / ch.slaMin) * 100)) };
}

/**
 * RF08b: alerta quando os passos foram marcados rápido demais.
 * Regra: menos de 2 s por passo, em média, entre o primeiro e o último.
 */
export function alertaTriagem(registros: Array<Pick<RegistroTriagem, 'at'>>, segPorPasso = 2): string | null {
  const ts = registros.filter((r) => r.at).map((r) => r.at);
  if (ts.length < 2) return null;
  const span = Math.max(...ts) - Math.min(...ts);
  if (span < segPorPasso * 1000 * (ts.length - 1)) {
    const seg = Math.max(1, Math.round(span / 1000));
    return `Os ${ts.length} passos da triagem foram marcados em ${seg} segundo${seg > 1 ? 's' : ''}. Pode ser que não tenham sido realmente executados.`;
  }
  return null;
}

/** RN13: o chamado só abre com todos os passos "feito" ou "não foi possível" com motivo. */
export function passoOk(reg: Partial<RegistroTriagem> | null | undefined, minMotivo = 10): boolean {
  if (!reg) return false;
  if (reg.st === 'feito') return true;
  return reg.st === 'imposs' && (reg.motivo || '').trim().length >= minMotivo;
}

/** RF09: incidente geral = N chamados abertos da mesma situação numa janela de tempo. */
export interface Incidente<C> { sitId: string; chamados: C[]; desde: number }

export function detectarIncidentes<C extends ChamadoBase>(chamados: C[], { janelaMin = 60, minimo = 3, agora = Date.now() } = {}): Incidente<C>[] {
  const grupos: Record<string, C[]> = {};
  for (const c of chamados) {
    if (!c.sitId || c.outros || FINAIS.includes(c.status)) continue;
    if (agora - (c.criadoEm ?? 0) > janelaMin * MIN) continue;
    (grupos[c.sitId] ||= []).push(c);
  }
  return Object.entries(grupos)
    .filter(([, cs]) => cs.length >= minimo)
    .map(([sitId, cs]) => ({ sitId, chamados: cs, desde: Math.min(...cs.map((c) => c.criadoEm ?? 0)) }));
}

/** RN07: reabertura em até 7 dias após o fechamento. */
export function podeReabrir(ch: ChamadoBase, agora: number = Date.now()): boolean {
  if (ch.status !== 'Concluído') return false;
  const fim = [...ch.hist].reverse().find((h) => h.status === 'Concluído');
  return !!fim && agora - fim.at <= 7 * DIA;
}

// ---------------- Estoque (§4) ----------------
export const STATUS_ITEM: StatusItem[] = ['Novo', 'Em uso', 'Disponível (usado)', 'Em manutenção', 'Em garantia', 'Quebrado', 'Descartado'];
export const TRANSICOES_ITEM: Record<StatusItem, StatusItem[]> = {
  Novo: ['Em uso'],
  'Em uso': ['Disponível (usado)', 'Em manutenção', 'Quebrado'],
  'Disponível (usado)': ['Em uso', 'Descartado'],
  'Em manutenção': ['Disponível (usado)', 'Quebrado', 'Em garantia'],
  'Em garantia': ['Novo', 'Quebrado'],
  Quebrado: ['Descartado'],
  Descartado: []
};
/** Local onde o item fica ao entrar em cada status (fora de baia). */
export const LOCAL_DO_STATUS: Partial<Record<StatusItem, LocalFora>> = {
  Novo: 'ALM',
  'Disponível (usado)': 'ALM',
  'Em manutenção': 'MNT',
  'Em garantia': 'GAR',
  Quebrado: 'MNT',
  Descartado: 'BXA'
};

export function podeTransicionar(de: StatusItem, para: StatusItem): boolean {
  return (TRANSICOES_ITEM[de] || []).includes(para);
}

export const DISPONIVEL: StatusItem[] = ['Novo', 'Disponível (usado)'];

/** RF27: consumo médio mensal (saídas para baia nos últimos 90 dias) e sugestão de compra. */
export function sugestaoCompra({ disponiveis, minimo, consumo90d }: { disponiveis: number; minimo: number; consumo90d: number }): { mensal: number; sugerir: number } {
  const mensal = consumo90d / 3;
  const alvo = Math.ceil(minimo + mensal);
  return { mensal: Math.round(mensal * 10) / 10, sugerir: Math.max(0, alvo - disponiveis) };
}
