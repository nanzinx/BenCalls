// Estágios do banimento do WhatsApp (os mesmos do BenHermes) e o que eles fazem com os chamados.
//
//   OK ──caiu──▶ BANIDO ──pedi análise──▶ EM ANÁLISE (o WhatsApp avalia; resposta em até ~1 dia)
//                                             ├─ liberado ──▶ OK
//                                             └─ negado ───▶ PERDIDO ──troquei o chip──▶ OK
//   OK ──restrição──▶ RESTRINGIDO (não conecta no WhatsApp Web até o fim do prazo) ──voltou──▶ OK
//
// Em análise e restringido não há manutenção a fazer: é esperar o WhatsApp. Nesses estágios o
// chamado de WhatsApp da baia fica "Pendente · aguardando o WhatsApp" e volta para o TI quando
// houver o que fazer (número perdido, restrição que terminou, análise sem resposta há 24 h).
// Quando o número volta a OK, o chamado é concluído. Tudo puro; "agora" vem por parâmetro.
import type { EstadoWhatsapp } from './benhermes/whatsapp.ts';
import { analiseAtrasada, restricaoVencida, tempoRestante, tempoDesde } from './benhermes/whatsappBaias.ts';
import { ABERTOS } from './rules.ts';
import type { StatusChamado } from './tipos.ts';

export type IdEtapa = 'ok' | 'banido' | 'analise' | 'analise-atrasada' | 'restringido' | 'restricao-vencida' | 'perdido' | 'nao-tem';

export interface EtapaWhatsapp {
  id: IdEtapa;
  titulo: string;
  /** O que está acontecendo, em uma frase */
  descricao: string;
  /** O que fazer agora (vazio quando é só esperar) */
  proximoPasso: string;
  /** Em análise ou restringido: é esperar o WhatsApp, sem manutenção */
  aguardandoWhatsapp: boolean;
  /** Quando deve haver novidade (resposta da análise ou fim da restrição), ISO */
  previsao?: string;
  /** "resposta esperada em 6h", "faltam 1d 3h" */
  quandoTexto?: string;
}

const HORA = 3_600_000;
export const PRAZO_ANALISE_HORAS = 24;

const dh = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function etapaDoWhatsapp(e: EstadoWhatsapp, agora: Date): EtapaWhatsapp {
  switch (e.situacao) {
    case 'BANIDO':
      return {
        id: 'banido', titulo: 'Banido', aguardandoWhatsapp: false,
        descricao: `O WhatsApp baniu o número há ${tempoDesde(e.mudouEm, agora)}.`,
        proximoPasso: 'Pedir a análise (revisão) ao WhatsApp na manutenção.'
      };
    case 'ANALISE': {
      const pedida = e.analisePedidaEm || e.mudouEm;
      const previsao = new Date(Date.parse(pedida) + PRAZO_ANALISE_HORAS * HORA).toISOString();
      if (analiseAtrasada(e, agora)) {
        return {
          id: 'analise-atrasada', titulo: 'Análise passou de 24 h', aguardandoWhatsapp: false, previsao,
          descricao: `A análise foi pedida há ${tempoDesde(pedida, agora)} e a resposta do WhatsApp já devia ter saído.`,
          proximoPasso: 'Conferir no celular se o número foi liberado ou perdido.'
        };
      }
      const faltam = Math.max(1, Math.ceil((Date.parse(previsao) - agora.getTime()) / HORA));
      return {
        id: 'analise', titulo: 'Em análise pelo WhatsApp', aguardandoWhatsapp: true, previsao,
        quandoTexto: `resposta esperada em até ${faltam}h (${dh(previsao)})`,
        descricao: 'O próprio WhatsApp está avaliando o número. A resposta costuma sair em até 1 dia: liberado (volta a funcionar) ou perdido.',
        proximoPasso: ''
      };
    }
    case 'RESTRINGIDO':
      if (restricaoVencida(e, agora)) {
        return {
          id: 'restricao-vencida', titulo: 'Restrição terminou', aguardandoWhatsapp: false, previsao: e.restritoAte,
          descricao: `A restrição acabou${e.restritoAte ? ` em ${dh(e.restritoAte)}` : ''}.`,
          proximoPasso: 'Conferir no WhatsApp Web se o número voltou a conectar.'
        };
      }
      return {
        id: 'restringido', titulo: 'Restringido', aguardandoWhatsapp: true, previsao: e.restritoAte,
        quandoTexto: e.restritoAte ? `até ${dh(e.restritoAte)} · faltam ${tempoRestante(e, agora)}` : undefined,
        descricao: 'O número não consegue se conectar no WhatsApp Web até o fim do prazo. Não dá para fazer manutenção: é esperar.',
        proximoPasso: ''
      };
    case 'PERMANENTE':
      return {
        id: 'perdido', titulo: 'Perdido', aguardandoWhatsapp: false,
        descricao: 'A análise foi negada e o número não volta mais.',
        proximoPasso: 'Trocar o chip da vaga.'
      };
    case 'NAO_TEM':
      return { id: 'nao-tem', titulo: 'Não tem WhatsApp', aguardandoWhatsapp: false, descricao: 'Esta baia não tem número.', proximoPasso: '' };
    default:
      return { id: 'ok', titulo: 'OK', aguardandoWhatsapp: false, descricao: 'O número está funcionando.', proximoPasso: '' };
  }
}

/** Os passos para a linha do tempo do chamado: caminho do banimento ou da restrição. */
export function passosDoCaminho(id: IdEtapa): { id: string; titulo: string }[] {
  if (id === 'restringido' || id === 'restricao-vencida') {
    return [{ id: 'restringido', titulo: 'Restringido' }, { id: 'restricao-vencida', titulo: 'Prazo terminou' }, { id: 'ok', titulo: 'Voltou' }];
  }
  return [
    { id: 'banido', titulo: 'Banido' },
    { id: 'analise', titulo: 'Em análise' },
    { id: 'resposta', titulo: id === 'perdido' ? 'Perdido · trocar o chip' : 'Liberado' }
  ];
}

// ---------------------------------------------------------------------------
// Chamados de WhatsApp acompanham o estágio do número
// ---------------------------------------------------------------------------

export interface ChamadoWhatsapp {
  id: number;
  layoutId?: string | null;
  pos?: string | null;
  sitId?: string;
  status: StatusChamado;
  tecnicoId?: string | null;
  hist: { status: StatusChamado; at: number; just?: string; user?: string }[];
  solucao?: unknown;
  /** Enquanto estiver esperando o WhatsApp (em análise ou restringido) */
  aguardandoWhatsapp?: { etapa: IdEtapa; desde: number; previsao?: string } | null;
}

export type MudancaChamado =
  | { tipo: 'concluido'; chamadoId: number; texto: string }
  | { tipo: 'aguardando'; chamadoId: number; texto: string }
  | { tipo: 'voltou-ao-ti'; chamadoId: number; texto: string }
  | { tipo: 'anotado'; chamadoId: number; texto: string };

export interface OrigemDaMudanca {
  /** Quem registra no histórico do chamado (id do usuário ou "BenHermes") */
  usuario: string;
  /** "Controle de WhatsApps" ou "BenHermes" */
  onde: string;
  /** Ação que mudou o número, já em minúsculas: "liberado", "pedi análise"… */
  acao?: string;
  /** " na manutenção (manhã)" */
  quando?: string;
  chipTrocado?: boolean;
}

/**
 * Atualiza os chamados de WhatsApp abertos de uma baia conforme o novo estado do número.
 * `sitsWhatsapp` são as situações do catálogo ligadas ao WhatsApp (marcadas com `whatsapp`).
 */
export function sincronizarChamados(
  chamados: ChamadoWhatsapp[],
  baia: { layoutId: string; pos: string },
  estado: EstadoWhatsapp,
  sitsWhatsapp: Set<string>,
  agora: number,
  origem: OrigemDaMudanca
): MudancaChamado[] {
  const etapa = etapaDoWhatsapp(estado, new Date(agora));
  const out: MudancaChamado[] = [];
  const acao = origem.acao ? `${origem.acao}${origem.quando || ''}` : etapa.titulo.toLowerCase();
  for (const c of chamados) {
    if (c.layoutId !== baia.layoutId || c.pos !== baia.pos || !c.sitId || !sitsWhatsapp.has(c.sitId) || !ABERTOS.includes(c.status)) continue;
    const registrar = (status: StatusChamado, just: string) => {
      c.status = status;
      c.hist.push({ status, at: agora, just, user: origem.usuario });
    };

    if (etapa.id === 'ok') {
      const just = `Resolvido no ${origem.onde}: ${acao}${origem.chipTrocado ? ', com chip novo' : ''}.`;
      c.solucao = { texto: just, causa: null, user: origem.usuario, at: agora, trocas: [] };
      c.aguardandoWhatsapp = null;
      registrar('Concluído', just);
      out.push({ tipo: 'concluido', chamadoId: c.id, texto: just });
      continue;
    }

    if (etapa.aguardandoWhatsapp) {
      c.aguardandoWhatsapp = { etapa: etapa.id, desde: agora, previsao: etapa.previsao };
      const just = `Aguardando o WhatsApp: ${etapa.titulo.toLowerCase()}${etapa.quandoTexto ? ` (${etapa.quandoTexto})` : ''}. ${etapa.id === 'analise' ? 'Sem manutenção até a resposta.' : 'Sem manutenção até o fim do prazo.'}`;
      if (c.status === 'Aguardando Consenso') continue;
      if (c.status !== 'Pendente') {
        registrar('Pendente', just);
        out.push({ tipo: 'aguardando', chamadoId: c.id, texto: just });
      } else {
        c.hist.push({ status: c.status, at: agora, just, user: origem.usuario });
        out.push({ tipo: 'anotado', chamadoId: c.id, texto: just });
      }
      continue;
    }

    // Banido, perdido, restrição que terminou, análise sem resposta: tem o que fazer.
    const just = `${origem.onde}: ${etapa.titulo.toLowerCase()}. ${etapa.proximoPasso}`.trim();
    if (c.aguardandoWhatsapp && c.status === 'Pendente') {
      c.aguardandoWhatsapp = null;
      registrar(c.tecnicoId ? 'Em Execução' : 'Em Análise', just);
      out.push({ tipo: 'voltou-ao-ti', chamadoId: c.id, texto: just });
    } else {
      c.aguardandoWhatsapp = null;
      c.hist.push({ status: c.status, at: agora, just, user: origem.usuario });
      out.push({ tipo: 'anotado', chamadoId: c.id, texto: just });
    }
  }
  return out;
}

/**
 * Prazos que vencem sozinhos (restrição que terminou, análise passou de 24 h) não têm evento:
 * esta função devolve ao TI os chamados que estavam aguardando e já têm o que fazer.
 */
export function revisarAguardando(
  chamados: ChamadoWhatsapp[],
  estadoDaBaia: (layoutId: string, pos: string) => EstadoWhatsapp | null,
  agora: number,
  usuario = 'sistema'
): MudancaChamado[] {
  const out: MudancaChamado[] = [];
  for (const c of chamados) {
    if (!c.aguardandoWhatsapp || c.status !== 'Pendente' || !c.layoutId || !c.pos) continue;
    const e = estadoDaBaia(c.layoutId, c.pos);
    if (!e) continue;
    const etapa = etapaDoWhatsapp(e, new Date(agora));
    if (etapa.aguardandoWhatsapp || etapa.id === 'ok') continue;
    const just = `${etapa.titulo}. ${etapa.proximoPasso}`.trim();
    c.aguardandoWhatsapp = null;
    c.status = c.tecnicoId ? 'Em Execução' : 'Em Análise';
    c.hist.push({ status: c.status, at: agora, just, user: usuario });
    out.push({ tipo: 'voltou-ao-ti', chamadoId: c.id, texto: just });
  }
  return out;
}
