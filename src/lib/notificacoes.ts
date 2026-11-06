// Quais chamados estão "para você": o que chegou para a pessoa resolver e ela ainda não viu.
// Usado no aviso ao entrar no site, no sino, na entrada animada e nos alertas em tempo real.
import { ABERTOS } from './rules.ts';
import type { StatusChamado } from './tipos.ts';

export type Motivo = 'encaminhado' | 'fila' | 'voltou';

export interface ChamadoNotificavel {
  id: number;
  status: StatusChamado;
  depto?: string;
  tecnicoId?: string | null;
  remetenteId?: string;
  criadoEm: number;
  /** Quando o chamado foi direcionado pela última vez (abertura, encaminhamento ou volta ao técnico). */
  direcionadoEm?: number;
  /** Quem fez o último direcionamento (não avisamos a pessoa sobre o que ela mesma fez). */
  direcionadoPor?: string;
  motivoDirecionamento?: Motivo;
}

export interface Pessoa {
  id: string;
  depto?: string;
  perfil?: string;
  acessos?: string[];
}

/** Ciência por pessoa: { [idDoChamado]: quando ela viu }. */
export type Ciencia = Record<string, number>;

export interface ParaVoce<C> {
  chamado: C;
  motivo: Motivo;
  em: number;
}

/** Quem atende chamados do próprio departamento: o TI (acesso ASC) e o RH (solicitações para o RH). */
export function atendeDepartamento(p: Pessoa): boolean {
  return (p.acessos || []).includes('ASC') || p.perfil === 'rh';
}

/** O chamado é da pessoa resolver? (não importa se ela já viu) */
export function motivoParaPessoa(c: ChamadoNotificavel, p: Pessoa): Motivo | null {
  if (!ABERTOS.includes(c.status) || c.status === 'Aguardando Consenso') return null;
  if (c.tecnicoId) {
    if (c.tecnicoId !== p.id) return null;
    return c.motivoDirecionamento === 'voltou' ? 'voltou' : 'encaminhado';
  }
  if (c.depto && c.depto === p.depto && atendeDepartamento(p) && c.remetenteId !== p.id) return 'fila';
  return null;
}

/** Chamados para a pessoa que ela ainda não viu, do mais recente para o mais antigo. */
export function paraVoce<C extends ChamadoNotificavel>(chamados: C[], p: Pessoa, ciencia: Ciencia = {}): ParaVoce<C>[] {
  const out: ParaVoce<C>[] = [];
  for (const c of chamados) {
    const motivo = motivoParaPessoa(c, p);
    if (!motivo) continue;
    if (c.direcionadoPor && c.direcionadoPor === p.id) continue;
    const em = c.direcionadoEm ?? c.criadoEm;
    if ((ciencia[String(c.id)] ?? 0) >= em) continue;
    out.push({ chamado: c, motivo, em });
  }
  return out.sort((a, b) => b.em - a.em);
}

export const TEXTO_MOTIVO: Record<Motivo, string> = {
  encaminhado: 'Encaminhado a você',
  fila: 'Novo na fila do seu departamento',
  voltou: 'Voltou para você'
};
