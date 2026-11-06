import type { Config } from 'tailwindcss';

/**
 * Sistema de design do BenCalls (mesmo modelo do BenHeimdall).
 *
 * As cores são trincas RGB em variáveis CSS (src/index.css), redefinidas no tema escuro e
 * pela personalização de cada empresa (components/Theme.jsx), para que os utilitários
 * aceitem transparência: `bg-marca/10`, `border-ruim/60`...
 */
const cor = (nome: string) => `rgb(var(--${nome}) / <alpha-value>)`;
const cores = (nomes: string[]) => Object.fromEntries(nomes.map((n) => [n, cor(n)]));

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  // Classes de componente montadas com `${...}` no JSX (o Tailwind não as encontra sozinho).
  safelist: [
    ...['marca', 'ok', 'aviso', 'ruim', 'info'].map((t) => `k-${t}`),
    ...['warn', 'bad', 'ok', 'info', 'gray'].map((t) => `note-${t}`),
    ...['ok', 'aberto', 'parado', 'vazia', 'off', 'wpp-ruim', 'perdido'].map((t) => `st-${t}`),
    ...['ok', 'alerta', 'neutro'].map((t) => `en-${t}`),
    'marca-normal', 'marca-entrada', 'bad', 'info'
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: cores([
        'fundo', 'superficie', 'superficie-2', 'superficie-3', 'tinta', 'tinta-2', 'mudo', 'linha', 'linha-forte',
        'marca', 'marca-2', 'marca-suave', 'marca-suave-2', 'marca-txt', 'sobre-marca',
        'destaque', 'sobre-destaque', 'assinatura',
        'ok', 'ok-fundo', 'ok-ponto',
        'aviso', 'aviso-fundo', 'aviso-ponto', 'aviso-borda',
        'ruim', 'ruim-fundo', 'ruim-ponto', 'ruim-borda',
        'info', 'info-fundo', 'laranja', 'laranja-fundo',
        'cinza', 'cinza-fundo', 'cinza-ponto'
      ]),
      fontFamily: {
        // Uma fonte só, neutra (Inter), para texto e títulos. A personalização pode trocar (--fonte).
        sans: ['var(--fonte)'],
        display: ['var(--fonte)'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'Consolas', 'monospace']
      },
      borderRadius: {
        cartao: '14px'
      },
      boxShadow: {
        cartao: 'var(--sombra)',
        flutuante: 'var(--sombra-2)',
        topo: '0 6px 24px rgb(7 29 77 / 0.28)',
        marca: '0 6px 16px rgb(var(--marca) / 0.32)',
        'marca-forte': '0 10px 22px rgb(var(--marca) / 0.4)'
      },
      spacing: {
        topo: 'var(--topo-h)'
      },
      transitionTimingFunction: {
        suave: 'cubic-bezier(0.22, 1, 0.36, 1)',
        mola: 'cubic-bezier(0.3, 1.5, 0.5, 1)'
      },
      keyframes: {
        surgir: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
        gaveta: { from: { opacity: '0', transform: 'translateY(14px) scale(0.985)' }, to: { opacity: '1', transform: 'none' } },
        pop: { from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
        esmaecer: { from: { opacity: '0' }, to: { opacity: '1' } },
        deslizar: { from: { opacity: '0', transform: 'translateX(30px)' }, to: { opacity: '1', transform: 'none' } },
        bolha: { from: { transform: 'translate(0, 0) scale(1)' }, to: { transform: 'translate(60px, -40px) scale(1.15)' } },
        faixa: { from: { backgroundPosition: '100% 0' }, to: { backgroundPosition: '-150% 0' } },
        piscar: { from: { opacity: '1' }, to: { opacity: '0.3' } },
        'pulso-ruim': {
          '0%': { boxShadow: '0 0 0 0 rgb(var(--ruim-ponto) / 0.45)' },
          '100%': { boxShadow: '0 0 0 9px transparent' }
        },
        'anel-destaque': {
          '0%': { boxShadow: '0 0 0 0 rgb(var(--destaque) / 0.7)' },
          '100%': { boxShadow: '0 0 0 8px transparent' }
        },
        'anel-ruim': {
          '0%': { boxShadow: '0 0 0 0 rgb(var(--ruim-ponto) / 0.6)' },
          '100%': { boxShadow: '0 0 0 7px transparent' }
        }
      },
      animation: {
        surgir: 'surgir 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        gaveta: 'gaveta 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        pop: 'pop 0.18s cubic-bezier(0.22, 1, 0.36, 1) both',
        esmaecer: 'esmaecer 0.15s ease-out both',
        deslizar: 'deslizar 0.2s cubic-bezier(0.22, 1, 0.36, 1) both',
        bolha: 'bolha 14s ease-in-out infinite alternate',
        faixa: 'faixa 9s linear infinite',
        piscar: 'piscar 0.9s ease-in-out infinite alternate',
        'pulso-ruim': 'pulso-ruim 1.8s ease-out infinite',
        'anel-destaque': 'anel-destaque 1.8s ease-out infinite',
        'anel-ruim': 'anel-ruim 1.6s ease-out infinite'
      }
    }
  },
  plugins: []
} satisfies Config;
