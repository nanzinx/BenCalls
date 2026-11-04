/** Exporta linhas para CSV compatível com Excel em português (separador ";" e BOM UTF-8). */
export function paraCsv(cabecalho, linhas) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cabecalho, ...linhas].map((l) => l.map(esc).join(';')).join('\r\n');
}

export function baixarCsv(nome, cabecalho, linhas) {
  const blob = new Blob([paraCsv(cabecalho, linhas)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome.endsWith('.csv') ? nome : `${nome}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
