// Ponte entre o Controle de WhatsApps (regras do BenHermes, em ./benhermes) e as baias do BenCalls.
// As duas pontas usam o mesmo código de baia (OP1-E3): a mesa do WhatsApp é achada pela sigla,
// que é a "base" do layout no BenCalls. Tudo puro; "agora" vem por parâmetro.
import type { Layout } from './tipos.ts';
import type { Acao, Centro, EstadoWhatsapp, Celular, MapaWhatsapp, Mesa, Sala, Situacao, VagaWhatsapp } from './benhermes/whatsapp.ts';
import type { Alerta, AlvoAlerta, TipoAlerta } from './benhermes/whatsappAlertas.ts';
import { alertas } from './benhermes/whatsappAlertas.ts';
import { estado, alterarLugarNoMapa, analiseAtrasada, restricaoVencida } from './benhermes/whatsappBaias.ts';
import { posicoesAtivas, codigoDoLugar } from './benhermes/mapaMesas.ts';
import { ondeEstaABaia } from './benhermes/celulares.ts';
import { acoesPossiveis } from './benhermes/whatsappManutencao.ts';
import { gravarAlteracao } from './benhermes/whatsappHistorico.ts';

export type { MapaWhatsapp, Situacao, Acao, Alerta, AlvoAlerta };

/** O que a ponte usa de um layout (mesa) do BenCalls. */
export interface LayoutBenCalls extends Pick<Layout, 'base' | 'centro' | 'esq' | 'dir' | 'inicio' | 'desativadas' | 'nome' | 'sala' | 'supervisorId'> {
  id?: string;
}

/** Ocupação das baias no BenCalls: { 'OP1:E2': { nome } } */
export type Ocupacao = Record<string, { nome: string } | null | undefined>;

const mesmaSigla = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();
const mesmoNome = (a: string, b: string) =>
  a.normalize('NFKD').replace(/[̀-ͯ]/g, '').trim().toUpperCase().replace(/\s+/g, ' ') ===
  b.normalize('NFKD').replace(/[̀-ͯ]/g, '').trim().toUpperCase().replace(/\s+/g, ' ');

export function acharMesa(mapa: MapaWhatsapp, sigla: string): { sala: Sala; mesa: Mesa } | null {
  for (const sala of mapa.salas) for (const mesa of sala.mesas) if (mesmaSigla(mesa.sigla, sigla)) return { sala, mesa };
  return null;
}

/** Centro do BenCalls (['SUP'], ['SUP','SUB'], []) no formato do BenHermes. */
export function centroDoLayout(centro: Layout['centro']): Centro {
  if (centro.includes('SUP') && centro.includes('SUB')) return 'SUPSUB';
  return centro.includes('SUP') ? 'SUP' : 'NENHUM';
}

export const desativadasDoLayout = (d: Layout['desativadas']): string[] => Object.entries(d || {}).filter(([, v]) => v).map(([k]) => k);

/** O WhatsApp de uma baia do BenCalls: situação, celular/vaga ligada e o que dá para fazer agora. */
export interface WhatsappDaBaia {
  sala: Sala;
  mesa: Mesa;
  posicao: string;
  codigo: string;
  operador: string;
  estado: EstadoWhatsapp;
  ligada: { celular: Celular; vaga: VagaWhatsapp } | null;
  alvo: AlvoAlerta;
  /** Precisa de ação? (pedir análise, análise atrasada, restrição vencida, perdido) */
  atencao: TipoAlerta | null;
  acoes: Acao[];
}

export function whatsappDaBaia(mapa: MapaWhatsapp | null | undefined, sigla: string, posicao: string, agora: Date): WhatsappDaBaia | null {
  if (!mapa) return null;
  const achada = acharMesa(mapa, sigla);
  if (!achada) return null;
  const { sala, mesa } = achada;
  if (posicao === 'SUB' || !posicoesAtivas(mesa).includes(posicao)) return null;
  if (posicao === 'SUP' && mesa.whatsappSupervisor === 'NAO_TEM') return null;
  const lugar = mesa.lugares[posicao];
  if (!lugar) return null;
  const e = lugar.whatsapp;
  return {
    sala,
    mesa,
    posicao,
    codigo: codigoDoLugar(mesa.sigla, posicao),
    operador: posicao === 'SUP' ? mesa.supervisor : lugar.operador,
    estado: e,
    ligada: ondeEstaABaia(mapa, mesa.id, posicao),
    alvo: { tipo: 'lugar', salaId: sala.id, mesaId: mesa.id, posicao },
    atencao: atencaoDoEstado(e, agora),
    acoes: acoesPossiveis(e, agora)
  };
}

/** Só o que pede ação de alguém (o que vai para o contador do menu e o selo da baia). */
export function atencaoDoEstado(e: EstadoWhatsapp, agora: Date): TipoAlerta | null {
  if (e.situacao === 'BANIDO') return 'PEDIR_ANALISE';
  if (analiseAtrasada(e, agora)) return 'ANALISE_ATRASADA';
  if (restricaoVencida(e, agora)) return 'RESTRICAO_VENCIDA';
  if (e.situacao === 'PERMANENTE') return 'PERMANENTE';
  return null;
}

const URGENTES: TipoAlerta[] = ['PEDIR_ANALISE', 'ANALISE_ATRASADA', 'RESTRICAO_VENCIDA', 'PERMANENTE'];
/** Alertas que pedem ação agora (sem os "restringido no prazo" e "não tem"). */
export const alertasUrgentes = (mapa: MapaWhatsapp | null | undefined, agora: Date): Alerta[] =>
  mapa ? alertas(mapa, agora).filter((a) => URGENTES.includes(a.tipo)) : [];

/** Cor da baia no mapa do BenCalls quando a camada do WhatsApp está ligada. */
export function tomDaSituacao(e: EstadoWhatsapp, agora: Date): 'ok' | 'ruim' | 'aviso' | 'escuro' | 'cinza' {
  if (e.situacao === 'OK') return 'ok';
  if (e.situacao === 'BANIDO') return 'ruim';
  if (e.situacao === 'ANALISE') return analiseAtrasada(e, agora) ? 'ruim' : 'aviso';
  if (e.situacao === 'RESTRINGIDO') return restricaoVencida(e, agora) ? 'ruim' : 'aviso';
  if (e.situacao === 'PERMANENTE') return 'escuro';
  return 'cinza';
}

/**
 * Cria o mapa do WhatsApp a partir das mesas do BenCalls (mesmas salas, siglas, lados e
 * desativadas), com os ocupantes de hoje. Todos começam OK; a supervisão usa o WhatsApp no PC.
 */
export function mapaDasMesas(layouts: LayoutBenCalls[], ocupacao: Ocupacao, nomeDoSupervisor: (id?: string) => string, agora: Date): MapaWhatsapp {
  const salas: Sala[] = [];
  for (const L of layouts) {
    let sala = salas.find((s) => s.nome === (L.sala || 'Sala'));
    if (!sala) { sala = { id: `sala-${slug(L.sala || 'sala')}`, nome: L.sala || 'Sala', mesas: [] }; salas.push(sala); }
    const centro = centroDoLayout(L.centro);
    const mesa: Mesa = {
      id: `mesa-${slug(L.base)}`,
      nome: L.nome || L.base,
      sigla: L.base,
      supervisor: centro === 'NENHUM' ? '' : nomeDoSupervisor(L.supervisorId).toUpperCase(),
      supervisorUserId: L.supervisorId ?? null,
      whatsappSupervisor: centro === 'NENHUM' ? 'NAO_TEM' : 'PC',
      esq: L.esq,
      dir: L.dir,
      centro,
      inicio: L.inicio || 'sup',
      desativadas: desativadasDoLayout(L.desativadas),
      lugares: {}
    };
    const chave = L.id || L.base;
    mesa.lugares = Object.fromEntries(posicoesAtivas(mesa).map((p) => [p, { operador: p === 'SUP' || p === 'SUB' ? '' : (ocupacao[`${chave}:${p}`]?.nome || '').toUpperCase(), whatsapp: estado('OK', agora) }]));
    sala.mesas.push(mesa);
  }
  const iso = agora.toISOString();
  return { versao: 3, salas, celulares: [], historico: [], manutencoes: [], manutencaoAtual: null, inicioDoHistorico: iso, atualizadoEm: iso };
}

const slug = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export type TipoDivergencia = 'mesa-so-no-whatsapp' | 'mesa-sem-whatsapp' | 'formato' | 'operador';
export interface Divergencia {
  tipo: TipoDivergencia;
  codigo: string;
  texto: string;
  /** Só em 'operador' */
  noBenCalls?: string;
  noWhatsapp?: string;
  posicao?: string;
  layoutId?: string;
}

/**
 * O que não bate entre as baias do BenCalls e o mapa do WhatsApp: mesas que só existem de um lado,
 * mesas com formato diferente e baias com operador diferente do ocupante registrado no BenCalls.
 */
export function divergencias(mapa: MapaWhatsapp, layouts: LayoutBenCalls[], ocupacao: Ocupacao): Divergencia[] {
  const out: Divergencia[] = [];
  const siglas = new Set(layouts.map((l) => l.base.toUpperCase()));
  for (const s of mapa.salas) for (const m of s.mesas) {
    if (!siglas.has(m.sigla.toUpperCase())) out.push({ tipo: 'mesa-so-no-whatsapp', codigo: m.sigla, texto: `${m.sigla} (${m.nome}) existe no Controle de WhatsApps, mas não nas mesas do BenCalls.` });
  }
  for (const L of layouts) {
    const achada = acharMesa(mapa, L.base);
    if (!achada) { out.push({ tipo: 'mesa-sem-whatsapp', codigo: L.base, layoutId: L.id, texto: `${L.base} (${L.nome || L.base}) não está no mapa do WhatsApp.` }); continue; }
    const { mesa } = achada;
    const difs: string[] = [];
    if (mesa.esq !== L.esq || mesa.dir !== L.dir) difs.push(`baias ${mesa.esq}+${mesa.dir} no WhatsApp × ${L.esq}+${L.dir} no BenCalls`);
    const desL = desativadasDoLayout(L.desativadas).sort().join(',');
    if ([...mesa.desativadas].sort().join(',') !== desL) difs.push('baias desativadas diferentes');
    if (difs.length) out.push({ tipo: 'formato', codigo: L.base, layoutId: L.id, texto: `${L.base}: ${difs.join('; ')}.` });
    const chave = L.id || L.base;
    for (const p of posicoesAtivas(mesa)) {
      if (!/^[ED]\d+$/.test(p)) continue;
      const noB = ocupacao[`${chave}:${p}`]?.nome || '';
      const noW = mesa.lugares[p]?.operador || '';
      if (!noB && !noW) continue;
      if (!mesmoNome(noB, noW)) {
        out.push({ tipo: 'operador', codigo: codigoDoLugar(mesa.sigla, p), posicao: p, layoutId: L.id, noBenCalls: noB, noWhatsapp: noW,
          texto: `${codigoDoLugar(mesa.sigla, p)}: ${noW || 'vazia'} no WhatsApp × ${noB || 'vazia'} no BenCalls.` });
      }
    }
  }
  return out;
}

/**
 * Passa os ocupantes do BenCalls para o mapa do WhatsApp (o BenCalls é quem sabe quem senta onde).
 * Grava no histórico do WhatsApp como troca de operador, igual ao BenHermes.
 */
export function usarOcupantesDoBenCalls(mapa: MapaWhatsapp, layouts: LayoutBenCalls[], ocupacao: Ocupacao, agora: Date): { mapa: MapaWhatsapp; trocas: number } {
  let novo = mapa;
  let trocas = 0;
  for (const d of divergencias(mapa, layouts, ocupacao)) {
    if (d.tipo !== 'operador' || !d.posicao) continue;
    const L = layouts.find((l) => (l.id || l.base) === d.layoutId);
    const achada = L && acharMesa(novo, L.base);
    if (!achada) continue;
    novo = alterarLugarNoMapa(novo, achada.sala.id, achada.mesa.id, d.posicao, { operador: (d.noBenCalls || '').toUpperCase() }, agora);
    trocas++;
  }
  return { mapa: trocas ? gravarAlteracao(mapa, novo, agora) : mapa, trocas };
}

/** Uma troca de ocupante no BenCalls passa para o WhatsApp na hora (se a baia existir lá). */
export function trocarOperador(mapa: MapaWhatsapp, sigla: string, posicao: string, nome: string, agora: Date): MapaWhatsapp {
  const achada = acharMesa(mapa, sigla);
  if (!achada || !achada.mesa.lugares[posicao] || posicao === 'SUP' || posicao === 'SUB') return mapa;
  if (mesmoNome(achada.mesa.lugares[posicao].operador, nome)) return mapa;
  const depois = alterarLugarNoMapa(mapa, achada.sala.id, achada.mesa.id, posicao, { operador: nome.trim().toUpperCase() }, agora);
  return gravarAlteracao(mapa, depois, agora);
}

export const TEXTO_SITUACAO: Record<Situacao, string> = {
  OK: 'OK',
  BANIDO: 'Banido',
  ANALISE: 'Em análise',
  PERMANENTE: 'Perdido',
  RESTRINGIDO: 'Restringido',
  NAO_TEM: 'Não tem'
};

export const TEXTO_ALERTA: Record<TipoAlerta, string> = {
  PEDIR_ANALISE: 'Banido: pedir a análise',
  ANALISE_ATRASADA: 'Análise com mais de 24 h',
  RESTRICAO_VENCIDA: 'Restrição terminou: conferir',
  PERMANENTE: 'Número perdido: trocar o chip',
  RESTRINGIDO: 'Restringido',
  NAO_TEM: 'Sem WhatsApp'
};
