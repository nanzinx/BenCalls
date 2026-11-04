export const MIN = 60_000;
export const HORA = 60 * MIN;
export const DIA = 24 * HORA;

export const pad = (n, w = 2) => String(n).padStart(w, '0');

export function numeroChamado(id, ano = 2026) {
  return `#${ano}-${pad(id, 4)}`;
}

export function hhmm(t) {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function hhmmss(t) {
  const d = new Date(t);
  return `${hhmm(t)}:${pad(d.getSeconds())}`;
}

export function dataCurta(t) {
  const d = new Date(t);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function dataHora(t, agora = Date.now()) {
  const d = new Date(t);
  const hoje = new Date(agora);
  const ontem = new Date(agora - DIA);
  const mesmoDia = (a, b) => a.toDateString() === b.toDateString();
  if (mesmoDia(d, hoje)) return `hoje, ${hhmm(t)}`;
  if (mesmoDia(d, ontem)) return `ontem, ${hhmm(t)}`;
  return `${dataCurta(t)} ${hhmm(t)}`;
}

/** "há 5 min", "há 2h 05min", "há 3 dias" */
export function idade(t, agora = Date.now()) {
  const m = Math.max(0, Math.round((agora - t) / MIN));
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  if (m < 1440) return `há ${Math.floor(m / 60)}h${m % 60 ? ` ${pad(m % 60)}min` : ''}`;
  const d = Math.floor(m / 1440);
  return `há ${d} dia${d > 1 ? 's' : ''}`;
}

/** 95 → "1h 35min"; 30 → "30 min"; 2880 → "2 dias" */
export function duracao(min) {
  const m = Math.round(Math.abs(min));
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.floor(m / 60)}h${m % 60 ? ` ${pad(m % 60)}min` : ''}`;
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return `${d} dia${d > 1 ? 's' : ''}${h ? ` ${h}h` : ''}`;
}

export function plural(n, um, varios) {
  return `${n} ${n === 1 ? um : varios}`;
}

export function iniciais(nome = '') {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

export function normalizar(s = '') {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
