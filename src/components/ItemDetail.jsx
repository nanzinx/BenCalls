import { useState } from 'react';
import { X, Printer, ArrowRightLeft, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { codigoItem, localItem, nomeItem, tem, baiaCodigo, ocupante } from '../store/selectors.js';
import { TRANSICOES_ITEM, DISPONIVEL } from '../lib/rules.js';
import { dataCurta, dataHora, numeroChamado, DIA } from '../lib/format.js';
import { posicoesDaMesa, posKey } from '../lib/labels.js';
import { ItemBadge, Note, StatusBadge } from './ui.jsx';

export function EtiquetaImpressa({ code, item, empresa }) {
  return (
    <div className="label-card">
      <div className="l-bar" />
      <span className="l-code">{code}</span>
      <span className="l-sub"><span>{nomeItem(item.tipo)} · {item.modelo}</span></span>
      <span className="l-sub"><b>{item.id}</b><span>{empresa}</span></span>
    </div>
  );
}

export default function ItemDetail({ id, onClose, abrir }) {
  const { st, user, actions, toast, agora } = useStore();
  const it = st.itens.find((x) => x.id === id);
  const [modo, setModo] = useState(null);
  const [novo, setNovo] = useState('');
  const [just, setJust] = useState('');
  const [dest, setDest] = useState({ layoutId: st.layouts[0].id, pos: '' });
  if (!it) return null;
  const code = codigoItem(st, it);
  const podeMexer = tem(user, 'EST') && tem(user, 'ASC');
  const garantiaDias = Math.round((it.garantiaAte - agora) / DIA);
  const chamados = st.chamados.filter((c) => c.itens.some((i) => i.assetId === it.id)).sort((a, b) => b.criadoEm - a.criadoEm);
  const transicoes = TRANSICOES_ITEM[it.status].filter((s) => s !== 'Em uso');
  const L = st.layouts.find((l) => l.id === dest.layoutId);

  return (
    <div className="stack" style={{ padding: 20 }}>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div className="stack-sm">
          <span className="small muted">{it.id} · {nomeItem(it.tipo)}</span>
          <h2 className="mono" style={{ fontSize: 22, color: 'var(--p-ink)' }}>{code}</h2>
          <div className="row"><ItemBadge status={it.status} />{it.descartePendente && <span className="badge badge-sm b-warn">Descarte aguardando aprovação</span>}</div>
        </div>
        <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
      </div>

      <div className="detail-grid">
        <div><div className="lbl">Modelo</div><div className="val">{it.modelo}</div></div>
        <div><div className="lbl">Nº de série</div><div className="val mono">{it.serie || '—'}</div></div>
        <div><div className="lbl">Fornecedor</div><div className="val">{it.fornecedor || '—'}</div></div>
        <div><div className="lbl">Compra</div><div className="val">{dataCurta(it.compra)}</div></div>
        <div><div className="lbl">Garantia até</div><div className="val" style={{ color: garantiaDias < 0 ? 'var(--muted)' : garantiaDias <= 45 ? 'var(--orange)' : undefined }}>{dataCurta(it.garantiaAte)}{garantiaDias >= 0 && garantiaDias <= 45 ? ` · vence em ${garantiaDias} dias` : garantiaDias < 0 ? ' · vencida' : ''}</div></div>
        <div><div className="lbl">Local</div><div className="val">{localItem(st, it)}</div></div>
        {it.local.kind === 'baia' && (
          <div style={{ gridColumn: '1 / -1' }}><div className="lbl">Ocupante da baia</div><div className="val">
            <button type="button" className="btn btn-sm btn-ghost" style={{ padding: 0, minHeight: 0 }} onClick={() => abrir({ baia: `${it.local.layoutId}:${it.local.pos}` })}>
              {baiaCodigo(st, it.local.layoutId, it.local.pos)} · {ocupante(st, it.local.layoutId, it.local.pos) || 'vazia'}
            </button></div></div>
        )}
      </div>

      <div className="stack-sm">
        <span className="small bold muted">Etiqueta</span>
        <div style={{ maxWidth: 260 }}><EtiquetaImpressa code={code} item={it} empresa={st.tema.empresa} /></div>
      </div>

      {it.descartePendente && tem(user, 'APROV') && (
        <Note tipo="warn" icon={ShieldCheck}>
          <div className="stack-sm">
            <span><b>Aprovação de descarte (RN05).</b> Item descartado não volta a nenhum status.</span>
            <div className="row">
              <button type="button" className="btn btn-sm btn-danger" onClick={() => { actions.decidirDescarte(it.id, true); toast(`${it.id} baixado do patrimônio.`); }}><CheckCircle2 size={14} /> Aprovar descarte</button>
              <button type="button" className="btn btn-sm" onClick={() => { actions.decidirDescarte(it.id, false); toast('Descarte recusado.'); }}><XCircle size={14} /> Recusar</button>
            </div>
          </div>
        </Note>
      )}

      {podeMexer && it.status !== 'Descartado' && !it.descartePendente && (
        <div className="row">
          {transicoes.length > 0 && <button type="button" className="btn" onClick={() => { setModo('status'); setNovo(transicoes[0]); }}>Alterar status</button>}
          {DISPONIVEL.includes(it.status) && <button type="button" className="btn btn-primary" onClick={() => setModo('instalar')}><ArrowRightLeft size={15} /> Instalar numa baia</button>}
          <button type="button" className="btn" onClick={() => window.print()}><Printer size={15} /> Imprimir etiqueta</button>
        </div>
      )}

      {modo === 'status' && (
        <div className="card card-flat stack-sm" style={{ background: 'var(--surface-2)' }}>
          <span className="small bold">Ciclo de vida (§4): de “{it.status}” pode ir para</span>
          <div className="row" style={{ gap: 6 }}>
            {transicoes.map((s) => <button key={s} type="button" className="pill" aria-pressed={novo === s} onClick={() => setNovo(s)}>{s}</button>)}
          </div>
          <input className="input" value={just} onChange={(e) => setJust(e.target.value)} placeholder="Observação (ex.: enviado à assistência técnica)" />
          {novo === 'Descartado' && <span className="small muted">O descarte precisa da aprovação do gestor antes de valer.</span>}
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => {
              const r = actions.mudarStatusItem(it.id, novo, just.trim());
              toast(r === 'pendente' ? 'Descarte enviado para aprovação do gestor.' : `${it.id} agora está “${novo}”. A etiqueta foi atualizada para o novo local.`);
              setModo(null); setJust('');
            }}>Confirmar</button>
            <button type="button" className="btn" onClick={() => setModo(null)}>Voltar</button>
          </div>
        </div>
      )}

      {modo === 'instalar' && (
        <div className="card card-flat stack-sm" style={{ background: 'var(--surface-2)' }}>
          <div className="grid-2" style={{ gap: 10 }}>
            <label className="field">Mesa
              <select className="select" value={dest.layoutId} onChange={(e) => setDest({ layoutId: e.target.value, pos: '' })}>
                {st.layouts.map((l) => <option key={l.id} value={l.id}>{l.base} · {l.sala} {l.nome}</option>)}
              </select>
            </label>
            <label className="field">Posição
              <select className="select" value={dest.pos} onChange={(e) => setDest({ ...dest, pos: e.target.value })}>
                <option value="">Escolha…</option>
                {posicoesDaMesa(L).map((p) => <option key={posKey(p)} value={posKey(p)}>{baiaCodigo(st, L.id, posKey(p))}</option>)}
              </select>
            </label>
          </div>
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={!dest.pos} onClick={() => {
              const cod = actions.instalarItem(it.id, dest.layoutId, dest.pos);
              toast(`Instalado. Nova etiqueta: ${cod}. Imprima e cole no item.`);
              setModo(null);
            }}>Instalar e gerar etiqueta</button>
            <button type="button" className="btn" onClick={() => setModo(null)}>Voltar</button>
          </div>
        </div>
      )}

      {chamados.length > 0 && (
        <div className="stack-sm">
          <span className="small bold muted">Chamados deste item</span>
          {chamados.map((c) => (
            <button key={c.id} type="button" className="ticket" style={{ padding: '8px 10px' }} onClick={() => abrir({ ch: c.id })}>
              <span className="t-top"><span className="t-num">{numeroChamado(c.id)} · {dataCurta(c.criadoEm)}</span><StatusBadge status={c.status} sm /></span>
              <span className="small">{c.titulo}{c.solucao?.causa ? ` · laudo: ${c.solucao.causa}` : ''}</span>
            </button>
          ))}
        </div>
      )}

      <div className="stack-sm">
        <span className="small bold muted">Histórico de movimentações (preso ao ID {it.id})</span>
        <div className="timeline">
          {[...it.hist].reverse().map((h, k) => (
            <div key={k} className="tl-item">
              <span className="tl-dot" style={{ background: 'var(--p)' }} />
              <div className="stack-sm" style={{ gap: 1 }}>
                <span>{h.txt}</span>
                <span className="tiny muted">{dataHora(h.at, agora)} · {h.user}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
