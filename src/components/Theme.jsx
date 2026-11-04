import { useEffect, useState } from 'react';
import { useStore } from '../store/store.jsx';
import { contraste, misturar, textoSobre } from '../lib/contrast.js';

const MODO_KEY = 'bencalls:modo';

export function useModo() {
  const [modo, setModo] = useState(() => {
    try { return localStorage.getItem(MODO_KEY) || 'claro'; } catch { return 'claro'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = modo === 'escuro' ? 'dark' : 'light';
    try { localStorage.setItem(MODO_KEY, modo); } catch { /* ignora */ }
    window.dispatchEvent(new Event('bencalls:modo'));
  }, [modo]);
  return [modo, setModo];
}

/** Calcula as variáveis CSS da marca a partir do tema da instalação (RF36). */
export function varsDoTema(tema, escuro) {
  const p = tema.primaria;
  const a = tema.destaque;
  const onA = contraste(a, p) >= 4.5 ? p : textoSobre(a);
  const ink = escuro
    ? (contraste(misturar(p, 0.55), '#151d2c') >= 4.5 ? misturar(p, 0.55) : '#9cbcf2')
    : (contraste(p, '#FFFFFF') >= 4.5 ? p : misturar(p, -0.45));
  return {
    '--p': p,
    '--p-hover': misturar(p, -0.3),
    '--p-soft': escuro ? misturar(p, -0.62) : misturar(p, 0.9),
    '--p-soft-2': escuro ? misturar(p, -0.72) : misturar(p, 0.95),
    '--p-ink': ink,
    '--on-p': textoSobre(p),
    '--a': a,
    '--on-a': onA,
    '--font': `'${tema.fonte}', system-ui, -apple-system, 'Segoe UI', sans-serif`
  };
}

export function ThemeApplier() {
  const { st } = useStore();
  const [escuro, setEscuro] = useState(document.documentElement.dataset.theme === 'dark');
  useEffect(() => {
    const f = () => setEscuro(document.documentElement.dataset.theme === 'dark');
    window.addEventListener('bencalls:modo', f);
    return () => window.removeEventListener('bencalls:modo', f);
  }, []);
  useEffect(() => {
    const vars = varsDoTema(st.tema, escuro);
    for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
    document.title = `${st.tema.nomeSistema} · ${st.tema.empresa}`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', st.tema.primaria);
  }, [st.tema, escuro]);
  useEffect(() => {
    const f = st.tema.fonte;
    if (!f || f === 'Inter' || f === 'system-ui') return;
    const id = `font-${f}`;
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id;
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f)}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(l);
  }, [st.tema.fonte]);
  return null;
}

export function Logo({ tema, size }) {
  return (
    <span className="logo" style={size ? { width: size, height: size, fontSize: size / 2 } : undefined} aria-hidden="true">
      {tema.logoImg ? <img src={tema.logoImg} alt="" /> : tema.logoTexto || tema.empresa?.[0] || 'B'}
    </span>
  );
}
