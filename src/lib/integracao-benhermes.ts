// Aplica no BenCalls o que o BenHermes avisou (API de integração, versão 1).
// Exemplo: a manutenção no BenHermes marca OP1-E3 como "Liberado" → aqui o WhatsApp da baia fica
// OK e o chamado de WhatsApp aberto naquela baia é concluído. Tudo puro; o store chama isto
// dentro do mutate, com uma cópia do estado.
import type { EstadoWhatsapp, MapaWhatsapp, Situacao, Acao, Janela } from './benhermes/whatsapp.ts';
import { alterarLugarNoMapa } from './benhermes/whatsappBaias.ts';
import { gravarAlteracao } from './benhermes/whatsappHistorico.ts';
import { ACAO, ROTULO_JANELA } from './benhermes/whatsappManutencao.ts';
import { acharMesa } from './whatsapp-baias.ts';
import { ABERTOS } from './rules.ts';
import type { StatusChamado } from './tipos.ts';

export interface EventoSituacao {
  id: string;
  tipo: 'whatsapp.situacao';
  em: string;
  recebidoEm?: number;
  dados: {
    codigo: string;
    de: Situacao;
    para: Situacao;
    acao?: Acao;
    estado: EstadoWhatsapp;
    chipTrocado?: boolean;
    manutencao?: { id: string; janela: Janela };
  };
}
export interface EventoManutencao {
  id: string;
  tipo: 'manutencao.concluida';
  em: string;
  recebidoEm?: number;
  dados: { id: string; inicio: string; fim: string; janela: Janela; conferidos: number; acoes: { acao: Acao; codigo: string }[] };
}
export type EventoBenHermes = EventoSituacao | EventoManutencao;

interface Chamado {
  id: number;
  layoutId?: string | null;
  pos?: string | null;
  sitId?: string;
  status: StatusChamado;
  titulo: string;
  hist: { status: StatusChamado; at: number; just?: string; user?: string }[];
  solucao?: unknown;
}
interface LayoutMin { id: string; base: string; sala?: string; nome?: string }

/** O pedaço do estado do BenCalls que a integração mexe. */
export interface EstadoBenCalls {
  whatsapp: MapaWhatsapp | null;
  chamados: Chamado[];
  layouts: LayoutMin[];
  integracao?: { benhermes?: RegistroIntegracao };
}
export interface RegistroIntegracao {
  /** ids já aplicados (os últimos 1000), para não aplicar duas vezes */
  aplicados: string[];
  /** até onde já buscou no servidor (recebidoEm, ms) */
  cursor: number;
  /** últimos eventos, para a tela */
  log: { id: string; em: string; texto: string; resultado: 'aplicado' | 'ignorado'; motivo?: string }[];
}

export type Efeito =
  | { tipo: 'chamado-concluido'; chamadoId: number; codigo: string; texto: string; grupo: string }
  | { tipo: 'whatsapp'; codigo: string; texto: string; grupo: string }
  | { tipo: 'manutencao'; texto: string };

export const USUARIO_BENHERMES = 'BenHermes';

/** "OP1-E3" → { sigla: "OP1", posicao: "E3" }; "DG-M1-D2" → { sigla: "DG-M1", posicao: "D2" } */
export function separarCodigo(codigo: string): { sigla: string; posicao: string } | null {
  const i = codigo.lastIndexOf('-');
  if (i <= 0) return null;
  return { sigla: codigo.slice(0, i), posicao: codigo.slice(i + 1) };
}

const registro = (st: EstadoBenCalls): RegistroIntegracao => {
  st.integracao ||= {};
  st.integracao.benhermes ||= { aplicados: [], cursor: 0, log: [] };
  return st.integracao.benhermes;
};

const quando = (e: EventoSituacao) =>
  e.dados.manutencao ? ` na manutenção (${ROTULO_JANELA[e.dados.manutencao.janela].toLowerCase()})` : '';

/**
 * Aplica os eventos (em ordem de tempo), ignorando os repetidos. `sitsWhatsapp` são as situações
 * do catálogo ligadas ao WhatsApp (ex.: "WhatsApp banido", "Número perdido"): só esses chamados
 * são concluídos quando o número volta a ficar OK.
 */
export function aplicarEventos(st: EstadoBenCalls, eventos: EventoBenHermes[], sitsWhatsapp: Set<string>, agora: number): Efeito[] {
  const reg = registro(st);
  const vistos = new Set(reg.aplicados);
  const efeitos: Efeito[] = [];
  const ordenados = [...eventos].sort((a, b) => a.em.localeCompare(b.em));
  for (const ev of ordenados) {
    if (vistos.has(ev.id)) continue;
    vistos.add(ev.id);
    reg.aplicados.push(ev.id);
    const r = ev.tipo === 'whatsapp.situacao' ? aplicarSituacao(st, ev, sitsWhatsapp, agora, efeitos) : aplicarManutencao(ev, efeitos);
    reg.log.unshift({ id: ev.id, em: ev.em, texto: r.texto, resultado: r.motivo ? 'ignorado' : 'aplicado', ...(r.motivo ? { motivo: r.motivo } : {}) });
  }
  if (reg.aplicados.length > 1000) reg.aplicados.splice(0, reg.aplicados.length - 1000);
  if (reg.log.length > 60) reg.log.length = 60;
  return efeitos;
}

function aplicarSituacao(st: EstadoBenCalls, ev: EventoSituacao, sitsWhatsapp: Set<string>, agora: number, efeitos: Efeito[]): { texto: string; motivo?: string } {
  const d = ev.dados;
  const rotulo = d.acao ? ACAO[d.acao].rotulo : `${d.de} → ${d.para}`;
  const texto = `${d.codigo}: ${rotulo}${quando(ev)}`;
  const partes = separarCodigo(d.codigo);
  const L = partes && st.layouts.find((l) => l.base.toUpperCase() === partes.sigla.toUpperCase());
  const grupo = L ? `Supervisão ${L.sala} · ${L.nome}` : 'TI';
  let motivo: string | undefined;

  // 1) O mapa do WhatsApp: vale o mais recente (se aqui mudou depois, fica o daqui).
  const achada = partes && st.whatsapp ? acharMesa(st.whatsapp, partes.sigla) : null;
  const lugar = achada && partes ? achada.mesa.lugares[partes.posicao] : undefined;
  if (!achada || !lugar || !partes) motivo = 'baia não existe no mapa do WhatsApp daqui';
  else if (Date.parse(lugar.whatsapp.mudouEm) > Date.parse(d.estado.mudouEm)) motivo = 'o WhatsApp desta baia mudou aqui depois';
  else if (JSON.stringify(lugar.whatsapp) !== JSON.stringify(d.estado)) {
    const t = new Date(d.estado.mudouEm);
    const antes = st.whatsapp!;
    st.whatsapp = gravarAlteracao(antes, alterarLugarNoMapa(antes, achada.sala.id, achada.mesa.id, partes.posicao, { whatsapp: d.estado }, t), t);
  }

  // 2) Os chamados: número de volta a OK conclui o chamado de WhatsApp aberto naquela baia.
  if (d.para === 'OK' && L && partes) {
    for (const c of st.chamados) {
      if (c.layoutId !== L.id || c.pos !== partes.posicao || !c.sitId || !sitsWhatsapp.has(c.sitId) || !ABERTOS.includes(c.status)) continue;
      const just = `Resolvido no BenHermes: ${rotulo.toLowerCase()}${quando(ev)}${d.chipTrocado ? ', com chip novo' : ''}.`;
      c.solucao = { texto: just, causa: null, user: USUARIO_BENHERMES, at: agora, trocas: [] };
      c.status = 'Concluído';
      c.hist.push({ status: 'Concluído', at: agora, just, user: USUARIO_BENHERMES });
      efeitos.push({ tipo: 'chamado-concluido', chamadoId: c.id, codigo: d.codigo, texto: just, grupo });
    }
  }
  if (d.para === 'BANIDO' || d.para === 'PERMANENTE') {
    efeitos.push({ tipo: 'whatsapp', codigo: d.codigo, grupo, texto: d.para === 'BANIDO' ? `WhatsApp ${d.codigo} caiu (registrado no BenHermes).` : `WhatsApp ${d.codigo} foi perdido: trocar o chip (BenHermes).` });
  }
  const fechou = efeitos.some((e) => e.tipo === 'chamado-concluido' && e.codigo === d.codigo);
  if (motivo && fechou) motivo = undefined; // o chamado foi tratado mesmo sem mexer no mapa
  return { texto, motivo };
}

function aplicarManutencao(ev: EventoManutencao, efeitos: Efeito[]): { texto: string; motivo?: string } {
  const d = ev.dados;
  const texto = `Manutenção ${ROTULO_JANELA[d.janela].toLowerCase()} concluída no BenHermes: ${d.conferidos} celular(es) conferido(s), ${d.acoes.length} ${d.acoes.length === 1 ? 'ação' : 'ações'}.`;
  efeitos.push({ tipo: 'manutencao', texto });
  return { texto };
}
