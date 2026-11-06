// Logo do BenCalls: um tíquete (o chamado) com o picote, o check de "resolvido" e o
// ponto amarelo de notificação. As cores vêm do tema (--p e --a), então a marca acompanha
// a personalização de cada empresa. Animações:
//  - em repouso, o ponto pulsa de leve (tem chamado chegando);
//  - no hover, o tíquete inclina e o check é redesenhado;
//  - na entrada (variante "entrada"), o tíquete cai no lugar, o check se desenha e saem ondas do ponto.
import type { CSSProperties } from 'react';

type Props = {
  tamanho?: number;
  variante?: 'normal' | 'entrada';
  titulo?: string;
  className?: string;
  style?: CSSProperties;
};

export function Marca({ tamanho = 36, variante = 'normal', titulo, className = '', style }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={tamanho}
      height={tamanho}
      className={`marca marca-${variante} ${className}`.trim()}
      style={style}
      role={titulo ? 'img' : undefined}
      aria-hidden={titulo ? undefined : true}
      aria-label={titulo}
    >
      <defs>
        <linearGradient id="marca-fundo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'rgb(var(--marca-2))' }} />
          <stop offset="1" style={{ stopColor: 'rgb(var(--marca))' }} />
        </linearGradient>
      </defs>
      <rect className="marca-fundo" width="64" height="64" rx="16" fill="url(#marca-fundo)" />
      <rect x="1" y="1" width="62" height="62" rx="15" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
      <g className="marca-ticket">
        <path
          d="M17 20h30a4 4 0 0 1 4 4v4.2a3.8 3.8 0 0 0 0 7.6V40a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4v-4.2a3.8 3.8 0 0 0 0-7.6V24a4 4 0 0 1 4-4Z"
          fill="#fff"
        />
        <path d="M41 23.5v17" style={{ stroke: 'rgb(var(--marca))' }} strokeWidth="2" strokeLinecap="round" strokeDasharray="0.1 4" />
        <path
          className="marca-check"
          d="M20.5 32.2l4.6 4.6 9.1-9.6"
          fill="none"
          style={{ stroke: 'rgb(var(--marca))' }}
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
        />
      </g>
      <g className="marca-ponto">
        <circle className="marca-onda" cx="50" cy="15" r="6" fill="none" style={{ stroke: 'rgb(var(--destaque))' }} strokeWidth="2" />
        <circle cx="50" cy="15" r="6.5" style={{ fill: 'rgb(var(--destaque))', stroke: 'rgb(var(--marca-2))' }} strokeWidth="2.5" />
      </g>
    </svg>
  );
}

/** Nome do sistema com o destaque na segunda parte: Ben<i>Calls</i>. */
export function NomeMarca({ nome }: { nome: string }) {
  const m = /^(Ben)(.+)$/.exec(nome);
  if (!m) return <>{nome}</>;
  return (
    <>
      {m[1]}
      <i>{m[2]}</i>
    </>
  );
}
