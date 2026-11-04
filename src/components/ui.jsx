import { useEffect, useRef, useState } from 'react';
import { X, Clock, PauseCircle, AlertTriangle, CheckCircle2, Info, Inbox, HelpCircle } from 'lucide-react';
import { useContagem } from './Entrada.tsx';
import { slaInfo } from '../lib/rules.ts';
import { duracao } from '../lib/format.ts';

export const COR_STATUS = {
  'Em Análise': 'b-blue', Pendente: 'b-orange', 'Em Execução': 'b-info', 'Aguardando Consenso': 'b-warn',
  Concluído: 'b-ok', Cancelado: 'b-gray', Negado: 'b-bad'
};
export const PONTO_STATUS = {
  'Em Análise': 'var(--p)', Pendente: '#b26a00', 'Em Execução': '#6b4bb0', 'Aguardando Consenso': 'var(--warn-dot)',
  Concluído: 'var(--ok-dot)', Cancelado: 'var(--gray-dot)', Negado: 'var(--bad-dot)'
};
export const COR_PRIO = { Crítica: 'b-bad', Alta: 'b-orange', Média: 'b-warn', Baixa: 'b-gray' };
export const COR_ITEM = {
  Novo: 'b-ok', 'Em uso': 'b-blue', 'Disponível (usado)': 'b-ok', 'Em manutenção': 'b-info',
  'Em garantia': 'b-orange', Quebrado: 'b-bad', Descartado: 'b-gray'
};
export const STATUS_LABEL_CURTO = { 'Aguardando Consenso': 'Aguardando confirmação' };

export function StatusBadge({ status, sm }) {
  return <span className={`badge ${sm ? 'badge-sm ' : ''}${COR_STATUS[status] || 'b-gray'}`}>{STATUS_LABEL_CURTO[status] || status}</span>;
}
export function PrioBadge({ prio, sm = true }) {
  return <span className={`badge ${sm ? 'badge-sm ' : ''}${COR_PRIO[prio] || 'b-gray'}`}>{prio}</span>;
}
export function ItemBadge({ status }) {
  return <span className={`badge badge-sm ${COR_ITEM[status] || 'b-gray'}`}>{status}</span>;
}
export function New() {
  return <span className="badge b-new">NOVO</span>;
}

export function Sla({ ch, agora, bar }) {
  const s = slaInfo(ch, agora);
  if (s.finalizado) return <span className="sla sla-pausado"><CheckCircle2 size={13} /> Encerrado</span>;
  const cls = s.pausado ? 'pausado' : s.nivel;
  const txt = s.pausado
    ? `SLA pausado · ${s.resta >= 0 ? `restam ${duracao(s.resta)}` : `estourou ${duracao(-s.resta)}`}`
    : s.resta >= 0 ? `SLA vence em ${duracao(s.resta)}` : `SLA estourado há ${duracao(-s.resta)}`;
  const cor = { ok: 'var(--ok-dot)', alerta: 'var(--warn-dot)', estourado: 'var(--bad-dot)', pausado: 'var(--gray-dot)' }[cls];
  return (
    <span className="stack-sm" style={{ gap: 4 }}>
      <span className={`sla sla-${cls}`}>{s.pausado ? <PauseCircle size={13} /> : <Clock size={13} />}{txt}</span>
      {bar && <span className="sla-bar"><i style={{ width: `${s.pct}%`, background: cor }} /></span>}
    </span>
  );
}

/** Número que conta de 0 até o valor quando aparece (aceita "72%" também). */
export function Contador({ valor }) {
  const m = typeof valor === 'number' ? [String(valor), String(valor), ''] : /^(\d+)(%?)$/.exec(String(valor));
  const n = useContagem(m ? Number(m[1]) : undefined, 120);
  return m ? <>{n}{m[2]}</> : <>{valor}</>;
}

export const TEXTO_SLA = 'SLA (Service Level Agreement, ou acordo de nível de serviço) é o prazo máximo para o TI resolver o chamado. Ele vem da prioridade: Crítica 1h, Alta 2h, Média 4h e Baixa 8h (ou menos, se o catálogo definir). O relógio só corre enquanto o chamado depende do TI (Em Análise e Em Execução); em Pendente e Aguardando confirmação ele pausa.';

/** Ícone de ajuda com balão (passar o mouse ou focar com o teclado). */
export function Ajuda({ titulo = 'O que é isso?', children }) {
  const [lado, setLado] = useState('');
  // O balão abre para o lado que tem espaço (não corta na borda da tela).
  const medir = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const w = Math.min(300, window.innerWidth * 0.8) / 2 + 16;
    setLado(`${r.left + w > window.innerWidth ? 'a-dir' : r.left - w < 0 ? 'a-esq' : ''}${r.top < 200 ? ' a-baixo' : ''}`);
  };
  return (
    <span className={`ajuda ${lado}`} onMouseEnter={medir} onFocus={medir}>
      <button type="button" className="ajuda-btn" aria-label={titulo}><HelpCircle size={14} /></button>
      <span className="ajuda-balao" role="tooltip">{children}</span>
    </span>
  );
}

export function AjudaSla() {
  return <Ajuda titulo="O que é SLA?"><b>O que é SLA?</b> {TEXTO_SLA}</Ajuda>;
}

export function Kpi({ label, valor, sub, destaque, icon: Icon, onClick, ajuda }) {
  return (
    <div className={`kpi${destaque ? ' destaque' : ''}`}>
      <span className="k-label">{Icon && <Icon size={14} />}{label}{ajuda}</span>
      <span className="k-valor"><Contador valor={valor} /></span>
      {sub && <span className="k-sub">{sub}</span>}
      {onClick && <button type="button" className="k-link" onClick={onClick} aria-label={`${label}: ${valor}. Ver detalhes`} />}
    </div>
  );
}

export function PageHead({ title, desc, children, badge }) {
  return (
    <div className="page-head">
      <div>
        <div className="row" style={{ gap: 10 }}><h1>{title}</h1>{badge}</div>
        {desc && <p>{desc}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

export function Empty({ icon: Icon = Inbox, title, children }) {
  return (
    <div className="empty">
      <Icon size={34} />
      <b style={{ color: 'var(--text)' }}>{title}</b>
      {children && <div className="small">{children}</div>}
    </div>
  );
}

export function Note({ tipo = 'info', children, icon }) {
  const I = icon || { warn: AlertTriangle, bad: AlertTriangle, ok: CheckCircle2, info: Info, gray: Info }[tipo];
  return <div role="note" className={`note note-${tipo}`}><I size={16} /><div>{children}</div></div>;
}

function useEsc(onClose) {
  useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onClose]);
}

export function Modal({ title, onClose, children, footer, size }) {
  useEsc(onClose);
  const ref = useRef(null);
  useEffect(() => { ref.current?.querySelector('input, textarea, select, button:not([data-close])')?.focus(); }, []);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal${size === 'lg' ? ' modal-lg' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" data-close className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ onClose, children, label }) {
  useEsc(onClose);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="drawer" role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>
  );
}

export function Field({ label, hint, hintTone, children }) {
  return (
    <label className="field">
      {label}
      {children}
      {hint && <span className={`hint ${hintTone || ''}`}>{hint}</span>}
    </label>
  );
}

export function Pills({ options, value, onChange, accent, label }) {
  return (
    <div className="row" role="group" aria-label={label} style={{ gap: 6 }}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return (
          <button key={v} type="button" className={`pill${accent ? ' pill-accent' : ''}`} aria-pressed={value === v} onClick={() => onChange(v)}>
            {l}{typeof o === 'object' && o.count !== undefined && <span className="count">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Seg({ options, value, onChange, label }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}>
          {o.icon && <o.icon size={15} />}{o.label}
        </button>
      ))}
    </div>
  );
}

export function Bars({ dados, cor = 'var(--p)', sufixo = '' }) {
  const max = Math.max(1, ...dados.map((d) => d[1]));
  return (
    <div className="bars">
      {dados.map(([l, v]) => (
        <div className="bar-row" key={l}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l}>{l}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(v / max) * 100}%`, background: cor }} /></div>
          <b style={{ textAlign: 'right' }}>{v}{sufixo}</b>
        </div>
      ))}
    </div>
  );
}

export function Assinatura({ extra }) {
  return (
    <div className="footer-sig">
      <span>Desenvolvido por</span>
      <span className="sig-chip"><i>B</i><b>BENCONSIG</b></span>
      {extra && <span className="no-print">· {extra}</span>}
    </div>
  );
}
