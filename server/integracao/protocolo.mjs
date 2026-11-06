// Formato dos eventos que o BenHermes manda para o BenCalls (versão 1).
// Tudo o que chega é conferido campo a campo; o que o front recebe depois é a versão "enxuta"
// (sem nomes de operadores nem números de chip), porque a leitura não tem login próprio.

export const SITUACOES = ['OK', 'BANIDO', 'ANALISE', 'PERMANENTE', 'RESTRINGIDO', 'NAO_TEM'];
export const ACOES = ['BANIDO', 'RESTRINGIDO', 'PEDIU_ANALISE', 'LIBERADO', 'PERDIDO', 'TROCOU_CHIP', 'VOLTOU'];
export const JANELAS = ['MANHA', 'ALMOCO', 'FORA'];
export const TIPOS = ['whatsapp.situacao', 'manutencao.concluida'];
export const MAX_EVENTOS = 100;

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const CODIGO = /^[A-Za-z0-9]{1,8}(-[A-Za-z0-9]{1,8}){0,2}-(E\d{1,2}|D\d{1,2}|SUP)$/;
const ID = /^[A-Za-z0-9:_.\-]{1,160}$/;

const ehIso = (v) => typeof v === 'string' && ISO.test(v) && !Number.isNaN(Date.parse(v));
const texto = (v, max) => typeof v === 'string' && v.length <= max;

function conferirEstado(e) {
  if (!e || typeof e !== 'object') return 'estado ausente';
  if (!SITUACOES.includes(e.situacao)) return 'estado.situacao inválida';
  if (!ehIso(e.mudouEm)) return 'estado.mudouEm inválido';
  if (e.analisePedidaEm !== undefined && !ehIso(e.analisePedidaEm)) return 'estado.analisePedidaEm inválido';
  if (e.restritoAte !== undefined && !ehIso(e.restritoAte)) return 'estado.restritoAte inválido';
  return null;
}

/** Confere um evento. Devolve null se estiver certo, ou o motivo. */
export function conferirEvento(ev) {
  if (!ev || typeof ev !== 'object' || Array.isArray(ev)) return 'evento não é um objeto';
  if (typeof ev.id !== 'string' || !ID.test(ev.id)) return 'id inválido';
  if (!TIPOS.includes(ev.tipo)) return `tipo desconhecido: ${String(ev.tipo).slice(0, 40)}`;
  if (!ehIso(ev.em)) return 'em inválido (use ISO 8601 em UTC)';
  const d = ev.dados;
  if (!d || typeof d !== 'object') return 'dados ausentes';
  if (ev.tipo === 'whatsapp.situacao') {
    if (typeof d.codigo !== 'string' || !CODIGO.test(d.codigo)) return 'dados.codigo inválido (ex.: OP1-E3)';
    if (!SITUACOES.includes(d.de) || !SITUACOES.includes(d.para)) return 'dados.de/para inválidos';
    if (d.acao !== undefined && !ACOES.includes(d.acao)) return 'dados.acao inválida';
    const e = conferirEstado(d.estado);
    if (e) return `dados.${e}`;
    if (d.estado.situacao !== d.para) return 'dados.estado.situacao diferente de dados.para';
    if (d.operador !== undefined && !texto(d.operador, 120)) return 'dados.operador inválido';
    if (d.numeroNovo !== undefined && !texto(d.numeroNovo, 40)) return 'dados.numeroNovo inválido';
    if (d.manutencao !== undefined && (!d.manutencao || !texto(d.manutencao.id, 80) || !JANELAS.includes(d.manutencao.janela))) return 'dados.manutencao inválida';
    return null;
  }
  // manutencao.concluida
  if (!texto(d.id, 80) || !d.id) return 'dados.id inválido';
  if (!ehIso(d.inicio) || !ehIso(d.fim)) return 'dados.inicio/fim inválidos';
  if (!JANELAS.includes(d.janela)) return 'dados.janela inválida';
  if (!Number.isInteger(d.conferidos) || d.conferidos < 0 || d.conferidos > 1000) return 'dados.conferidos inválido';
  if (!Array.isArray(d.acoes) || d.acoes.length > 500) return 'dados.acoes inválidas';
  for (const a of d.acoes) {
    if (!a || !ACOES.includes(a.acao) || !(a.codigo === '' || (typeof a.codigo === 'string' && CODIGO.test(a.codigo)))) return 'dados.acoes com item inválido';
  }
  if (d.texto !== undefined && !texto(d.texto, 8000)) return 'dados.texto inválido';
  return null;
}

/** Aceita { eventos: [...] } ou um evento só. Devolve { eventos } ou { erro }. */
export function lerLote(json) {
  const lista = json && Array.isArray(json.eventos) ? json.eventos : json && json.tipo ? [json] : null;
  if (!lista) return { erro: 'mande { "eventos": [ ... ] }' };
  if (!lista.length) return { erro: 'nenhum evento' };
  if (lista.length > MAX_EVENTOS) return { erro: `no máximo ${MAX_EVENTOS} eventos por mensagem` };
  for (let i = 0; i < lista.length; i++) {
    const m = conferirEvento(lista[i]);
    if (m) return { erro: `evento ${i + 1}: ${m}` };
  }
  return { eventos: lista };
}

/** Versão que o front lê: só o que precisa para atualizar o mapa e fechar os chamados. */
export function enxugar(ev) {
  const d = ev.dados;
  if (ev.tipo === 'whatsapp.situacao') {
    const estado = { situacao: d.estado.situacao, mudouEm: d.estado.mudouEm };
    if (d.estado.analisePedidaEm) estado.analisePedidaEm = d.estado.analisePedidaEm;
    if (d.estado.restritoAte) estado.restritoAte = d.estado.restritoAte;
    return {
      id: ev.id, tipo: ev.tipo, em: ev.em,
      dados: {
        codigo: d.codigo, de: d.de, para: d.para, estado,
        ...(d.acao ? { acao: d.acao } : {}),
        ...(d.numeroNovo ? { chipTrocado: true } : {}),
        ...(d.manutencao ? { manutencao: { id: d.manutencao.id, janela: d.manutencao.janela } } : {})
      }
    };
  }
  return {
    id: ev.id, tipo: ev.tipo, em: ev.em,
    dados: { id: d.id, inicio: d.inicio, fim: d.fim, janela: d.janela, conferidos: d.conferidos, acoes: d.acoes.map((a) => ({ acao: a.acao, codigo: a.codigo })) }
  };
}
