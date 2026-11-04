import { montarCodigo, codigoLocal, parsePosKey, ITEM_NOMES, LOCAIS } from '../lib/labels.js';
import { ABERTOS, FINAIS, DISPONIVEL } from '../lib/rules.js';
import { PERFIS } from '../data/seed.js';

export const layoutById = (st, id) => st.layouts.find((l) => l.id === id);
export const userById = (st, id) => st.usuarios.find((u) => u.id === id);
export const nomeUser = (st, id) => userById(st, id)?.nome || id || '—';

export function acessosDe(user) {
  if (!user) return [];
  return user.acessos || PERFIS[user.perfil]?.acessos || [];
}
export const tem = (user, a) => acessosDe(user).includes(a);

export function baiaCodigo(st, layoutId, pos) {
  const L = layoutById(st, layoutId);
  if (!L || !pos) return '—';
  return montarCodigo(L, parsePosKey(pos));
}

/** Etiqueta atual do item (calculada; o ID interno nunca muda — RN12). */
export function codigoItem(st, item) {
  if (!item) return '—';
  if (item.local.kind === 'baia') {
    const L = layoutById(st, item.local.layoutId);
    if (!L) return '—';
    const mesmos = st.itens.filter((i) => i.local.kind === 'baia' && i.local.layoutId === L.id && i.local.pos === item.local.pos && i.tipo === item.tipo);
    const dup = mesmos.length > 1 ? item.slot || 1 : 0;
    return montarCodigo(L, parsePosKey(item.local.pos), item.tipo, dup);
  }
  return codigoLocal(item.local.kind, item.tipo, item.local.seq);
}

export function localItem(st, item) {
  if (item.local.kind === 'baia') {
    const L = layoutById(st, item.local.layoutId);
    return L ? `${L.sala} · ${L.nome} · ${item.local.pos}` : '—';
  }
  return LOCAIS[item.local.kind];
}

export const nomeItem = (sigla) => ITEM_NOMES[sigla] || sigla;

export function itensDaBaia(st, layoutId, pos) {
  return st.itens
    .filter((i) => i.local.kind === 'baia' && i.local.layoutId === layoutId && i.local.pos === pos)
    .sort((a, b) => ['PC', 'MN', 'TC', 'MS', 'HS', 'CB', 'TB'].indexOf(a.tipo) - ['PC', 'MN', 'TC', 'MS', 'HS', 'CB', 'TB'].indexOf(b.tipo) || (a.slot || 1) - (b.slot || 1));
}

export function chamadosDaBaia(st, layoutId, pos, { abertos = false } = {}) {
  return st.chamados.filter((c) => c.layoutId === layoutId && c.pos === pos && (!abertos || ABERTOS.includes(c.status)));
}

/** RF30: verde (ok), amarelo (chamado aberto), vermelho (operador parado), cinza (vazia). */
export function statusBaia(st, layoutId, pos) {
  const abertos = chamadosDaBaia(st, layoutId, pos, { abertos: true });
  if (abertos.some((c) => c.operadorParado && c.status !== 'Aguardando Consenso')) return 'parado';
  if (abertos.length) return 'aberto';
  if (!st.ocupacao[`${layoutId}:${pos}`]) return 'vazia';
  return 'ok';
}

export function ocupante(st, layoutId, pos) {
  return st.ocupacao[`${layoutId}:${pos}`]?.nome || null;
}

export function layoutsDoUsuario(st, user) {
  if (!user) return [];
  if (user.perfil === 'supervisor') return st.layouts.filter((l) => (user.equipes || []).includes(l.id));
  return st.layouts;
}

/** RN06: supervisor só vê as baias da sua equipe; TI e gestão veem tudo. */
export function chamadosVisiveis(st, user) {
  if (!user) return [];
  if (user.perfil === 'supervisor') {
    const eq = user.equipes || [];
    return st.chamados.filter((c) => c.remetenteId === user.id || (c.layoutId && eq.includes(c.layoutId)));
  }
  return st.chamados;
}

export function indiceCatalogo(st) {
  const cats = {};
  const subs = {};
  const sits = {};
  for (const c of st.catalogo) {
    cats[c.id] = c;
    for (const s of c.subs) {
      subs[s.id] = { ...s, cat: c };
      for (const x of s.sits) sits[x.id] = { ...x, sub: s, cat: c };
    }
  }
  return { cats, subs, sits };
}

export function subDoItem(st, sigla) {
  for (const c of st.catalogo) for (const s of c.subs) if (s.item === sigla) return { ...s, cat: c };
  return null;
}

export function estoquePorTipo(st) {
  return st.tipos.map((t) => {
    const doTipo = st.itens.filter((i) => i.tipo === t.sigla);
    const disp = doTipo.filter((i) => DISPONIVEL.includes(i.status)).length;
    return { ...t, total: doTipo.length, disponiveis: disp, emUso: doTipo.filter((i) => i.status === 'Em uso').length, abaixo: disp < t.minimo };
  });
}

export const ehAberto = (c) => ABERTOS.includes(c.status);
export const ehFinal = (c) => FINAIS.includes(c.status);
