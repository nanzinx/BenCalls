// Padrão de etiqueta e geometria das mesas (escopo §2.4, §2.7, §4.1, §4.2).
// O código impresso é SEMPRE calculado a partir do layout + posição + item.
// O histórico fica preso ao ID interno do item (BEN-0000), nunca ao código (RN12).

export const ITEM_NOMES = {
  PC: 'Computador',
  MN: 'Monitor',
  TC: 'Teclado',
  MS: 'Mouse',
  HS: 'Headset',
  CB: 'Cabo/adaptador',
  TB: 'Tablet'
};
export const ITENS_PADRAO = ['PC', 'MN', 'TC', 'MS', 'HS'];
export const PAPEIS = { SUP: 'Supervisor', SUB: 'Sub-líder', LID: 'Líder da sala' };
export const TOKENS = { grupo: 'Grupo', lado: 'Lado (E/D)', posicao: 'Posição', item: 'Item' };

export const LOCAIS = {
  ALM: 'Almoxarifado',
  MNT: 'Manutenção',
  GAR: 'Fornecedor (garantia)',
  BXA: 'Baixado do patrimônio'
};

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** Chave estável de uma posição dentro da mesa: "E2", "D5", "SUP", "SUB". */
export function posKey(pos) {
  return pos.papel ? pos.papel : `${pos.lado}${pos.num}`;
}

export function parsePosKey(key) {
  if (PAPEIS[key]) return { papel: key };
  const m = /^([ED])(\d+)$/.exec(key);
  return m ? { lado: m[1], num: Number(m[2]) } : null;
}

/**
 * Monta o código seguindo o padrão da mesa.
 * Benconsig: {grupo}-{lado}{posicao}-{item} → OP1-E2-HS
 * Outro cliente: {grupo}-{posicao}-{item} → 3B-07-HS
 * `dup` (1, 2…) numera itens repetidos do mesmo tipo na baia: OP1-E2-MN1 / MN2.
 */
export function montarCodigo(layout, pos, sigla, dup) {
  const padrao = layout.padrao && layout.padrao.length ? layout.padrao : ['grupo'];
  const toks = padrao.filter((k) => (sigla ? true : k !== 'item'));
  const temLado = padrao.includes('lado');
  const partes = [];
  for (let i = 0; i < toks.length; i++) {
    const k = toks[i];
    if (k === 'grupo') partes.push(layout.base);
    else if (k === 'lado') {
      if (pos.papel) continue;
      if (toks[i + 1] === 'posicao') {
        partes.push(pos.lado + pos.num);
        i++;
      } else partes.push(pos.lado);
    } else if (k === 'posicao') {
      if (pos.papel) partes.push(pos.papel);
      else partes.push(temLado ? String(pos.num) : pad(pos.lado === 'D' ? layout.esq + pos.num : pos.num));
    } else if (k === 'item') partes.push(sigla + (dup ? String(dup) : ''));
  }
  return partes.join(layout.sep ?? '-');
}

/** Código de item fora de baia: ALM-HS-007. */
export function codigoLocal(local, sigla, seq) {
  if (local === 'BXA') return '—';
  return `${local}-${sigla}-${pad(seq, 3)}`;
}

/** Lista as posições da mesa (centro + lados), respeitando baias desativadas. */
export function posicoesDaMesa(layout, { incluirDesativadas = false } = {}) {
  const out = (layout.centro || []).map((p) => ({ papel: p }));
  const off = layout.desativadas || {};
  for (let i = 1; i <= layout.esq; i++) if (incluirDesativadas || !off[`E${i}`]) out.push({ lado: 'E', num: i });
  for (let i = 1; i <= layout.dir; i++) if (incluirDesativadas || !off[`D${i}`]) out.push({ lado: 'D', num: i });
  return out;
}

/**
 * Linhas do desenho da mesa. A baia 1 fica perto do supervisor (topo)
 * ou perto da porta (base), conforme `inicio` (§4.2).
 */
export function linhasDaMesa(layout) {
  const rows = [];
  const n = Math.max(layout.esq, layout.dir);
  for (let i = 1; i <= n; i++) {
    rows.push({
      esq: i <= layout.esq ? { lado: 'E', num: i } : null,
      dir: i <= layout.dir ? { lado: 'D', num: i } : null
    });
  }
  if (layout.inicio === 'porta') rows.reverse();
  return rows;
}

/** Validação do editor de espaços (RF38/RF39). Retorna mensagem de erro ou ''. */
export function validarMesa(m, siglasUsadas = []) {
  const ativas = posicoesDaMesa(m).filter((p) => !p.papel).length;
  if (!m.base) return 'Informe a sigla do grupo.';
  if (!/^[A-Z0-9][A-Z0-9-]{0,7}$/.test(m.base)) return 'A sigla aceita só letras, números e hífen (até 8 caracteres).';
  if (!m.padrao.includes('grupo')) return 'Inclua o campo Grupo na etiqueta, senão mesas diferentes repetiriam os códigos.';
  if (!m.padrao.includes('posicao')) return 'Inclua o campo Posição na etiqueta, senão duas baias teriam o mesmo código.';
  if (!m.padrao.includes('item')) return 'Inclua o campo Item na etiqueta para diferenciar os equipamentos da mesma baia.';
  if (siglasUsadas.includes(m.base)) return `Já existe uma mesa com a sigla ${m.base}. Escolha outra.`;
  if (ativas === 0) return 'A mesa precisa de pelo menos uma baia ativa.';
  if (!m.itens.length) return 'Escolha pelo menos um item padrão por baia.';
  return '';
}

/** Lê um código digitado e tenta descobrir a mesa/posição/item. */
export function lerCodigo(code, layouts) {
  const c = String(code || '').trim().toUpperCase();
  for (const L of layouts) {
    for (const pos of posicoesDaMesa(L, { incluirDesativadas: true })) {
      const baia = montarCodigo(L, pos);
      if (c === baia) return { layoutId: L.id, pos: posKey(pos), item: null };
      if (c.startsWith(baia + (L.sep ?? '-'))) {
        const resto = c.slice(baia.length + (L.sep ?? '-').length);
        const m = /^([A-Z]{2})(\d?)$/.exec(resto);
        if (m) return { layoutId: L.id, pos: posKey(pos), item: m[1], dup: m[2] ? Number(m[2]) : 0 };
      }
    }
  }
  return null;
}
