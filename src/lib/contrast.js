// RF37: validação automática de contraste (WCAG 2.1).

export function hexParaRgb(hex) {
  const h = String(hex || '').replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function lum([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contraste(a, b) {
  const ra = hexParaRgb(a);
  const rb = hexParaRgb(b);
  if (!ra || !rb) return 1;
  const [l1, l2] = [lum(ra), lum(rb)].sort((x, y) => y - x);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
}

/** Classificação: AA texto normal ≥ 4.5; AA texto grande/ícones ≥ 3. */
export function nivelContraste(r) {
  if (r >= 7) return { nivel: 'AAA', ok: true };
  if (r >= 4.5) return { nivel: 'AA', ok: true };
  if (r >= 3) return { nivel: 'AA grande', ok: true, aviso: true };
  return { nivel: 'Ilegível', ok: false };
}

/** Clareia (t>0) ou escurece (t<0) uma cor misturando com branco/preto. */
export function misturar(hex, t) {
  const rgb = hexParaRgb(hex);
  if (!rgb) return hex;
  const alvo = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  return '#' + rgb.map((c) => Math.round(c + (alvo - c) * k).toString(16).padStart(2, '0')).join('');
}

/** Melhor cor de texto (branco ou quase-preto) sobre um fundo. */
export function textoSobre(bg) {
  return contraste(bg, '#FFFFFF') >= contraste(bg, '#141A26') ? '#FFFFFF' : '#141A26';
}
