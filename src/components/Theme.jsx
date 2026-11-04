import { useEffect, useState } from 'react';
import { useStore } from '../store/store.jsx';
import { contraste, misturar, textoSobre } from '../lib/contrast.ts';
import { Marca } from './Marca.tsx';

/** Fontes servidas pelo próprio site (sem CDN externo, o CSP fica fechado). */
export const FONTES = {
  Inter: "'Inter Variable', 'Segoe UI', Roboto, Arial, sans-serif",
  'Space Grotesk': "'Space Grotesk Variable', 'Segoe UI', sans-serif",
  Sistema: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
};

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
    '--font': FONTES[tema.fonte] || FONTES.Inter
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
  return null;
}

/** Logo da instalação: a imagem enviada pela empresa ou a marca animada do BenCalls. */
export function Logo({ tema, size = 38 }) {
  if (tema.logoImg) {
    return <span className="logo" style={{ width: size, height: size }} aria-hidden="true"><img src={tema.logoImg} alt="" /></span>;
  }
  return <Marca tamanho={size} />;
}
