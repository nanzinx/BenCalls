import { useStore } from '../store/store.jsx';
import { baiaCodigo, statusBaia, chamadosDaBaia } from '../store/selectors.js';
import { linhasDaMesa, posKey, PAPEIS, montarCodigo } from '../lib/labels.ts';
import { numeroChamado } from '../lib/format.ts';
import { ST_BAIA } from './BaiaDetail.jsx';
import { whatsappDaBaia, tomDaSituacao, TEXTO_SITUACAO } from '../lib/whatsapp-baias.ts';
import { tempoDoEstado } from './WhatsappUi.jsx';

// Camada WhatsApp: cor da baia pela situação do número (regras do BenHermes).
const CLASSE_WPP = { ok: 'ok', aviso: 'aberto', ruim: 'wpp-ruim', escuro: 'perdido', cinza: 'vazia' };
export const ST_WPP = {
  ok: { label: 'OK', dot: 'rgb(var(--ok-ponto))' },
  aviso: { label: 'Em análise / restringido', dot: 'rgb(var(--aviso-ponto))' },
  ruim: { label: 'Banido ou precisa de ação', dot: 'rgb(var(--ruim-ponto))' },
  escuro: { label: 'Perdido', dot: 'rgb(var(--tinta))' },
  cinza: { label: 'Não tem', dot: 'rgb(var(--cinza-ponto))' }
};

export function Legenda({ camada }) {
  return (
    <div className="legend" aria-label="Legenda do mapa">
      {Object.entries(camada === 'whatsapp' ? ST_WPP : ST_BAIA).map(([k, v]) => <span key={k}><span className="dot" style={{ background: v.dot }} />{v.label}</span>)}
    </div>
  );
}

/** Desenho da mesa no mesmo layout físico (RF29), com cores por situação (RF30). */
export default function DeskMap({ layout: L, sel, onPick, compact, mostrarChamado, camada }) {
  const { st, agora } = useStore();
  const seat = (pos, center) => {
    const k = posKey(pos);
    const off = !pos.papel && L.desativadas?.[k];
    if (off) return <div className={`seat st-off${compact ? ' compact' : ''}`} key={k}>Desativada</div>;
    const code = baiaCodigo(st, L.id, k);
    if (camada === 'whatsapp') return seatWhatsapp(pos, k, code, center);
    const status = statusBaia(st, L.id, k);
    const oc = st.ocupacao[`${L.id}:${k}`]?.nome;
    const ab = mostrarChamado ? chamadosDaBaia(st, L.id, k, { abertos: true }) : [];
    const label = pos.papel ? PAPEIS[pos.papel] : null;
    return (
      <button key={k} type="button" className={`seat st-${status}${center ? ' center' : ''}${sel === k ? ' sel' : ''}${compact ? ' compact' : ''}`}
        onClick={() => onPick?.(k)} aria-pressed={sel === k}
        aria-label={`Baia ${code}, ${oc || 'sem ocupante'}, ${ST_BAIA[status].label}${ab.length ? `, ${ab.length} chamado(s) aberto(s)` : ''}`}>
        <span className="s-code">{compact ? code.replace(`${L.base}-`, '') : code}<span className="dot" style={{ background: ST_BAIA[status].dot }} /></span>
        {!compact && <span className="s-occ">{oc ? `${label ? `${label} · ` : ''}${oc}` : 'Sem ocupante'}</span>}
        {!compact && <span className="s-st">{ab.length ? ab.map((c) => numeroChamado(c.id)).join(' · ') : ST_BAIA[status].label}</span>}
        {compact && ab.length > 0 && <span className="text-[11px] text-tinta-2">{ab.length} chamado{ab.length > 1 ? 's' : ''}</span>}
      </button>
    );
  };
  const seatWhatsapp = (pos, k, code, center) => {
    const d = new Date(agora);
    const w = whatsappDaBaia(st.whatsapp, L.base, k, d);
    const tom = w ? tomDaSituacao(w.estado, d) : null;
    const oc = st.ocupacao[`${L.id}:${k}`]?.nome;
    const label = pos.papel ? PAPEIS[pos.papel] : null;
    const txt = w ? `${TEXTO_SITUACAO[w.estado.situacao]}${tempoDoEstado(w.estado, d) ? ` · ${tempoDoEstado(w.estado, d)}` : ''}` : 'Sem WhatsApp';
    return (
      <button key={k} type="button" className={`seat st-${tom ? CLASSE_WPP[tom] : 'vazia'}${center ? ' center' : ''}${sel === k ? ' sel' : ''}${compact ? ' compact' : ''}`}
        onClick={() => onPick?.(k)} aria-pressed={sel === k} aria-label={`Baia ${code}, ${oc || 'sem ocupante'}, WhatsApp: ${txt}`}>
        <span className="s-code">{compact ? code.replace(`${L.base}-`, '') : code}{tom && <span className="dot" style={{ background: ST_WPP[tom].dot }} />}</span>
        {!compact && <span className="s-occ">{oc ? `${label ? `${label} · ` : ''}${oc}` : 'Sem ocupante'}</span>}
        <span className={compact ? 'text-[11px] text-tinta-2 truncate' : 's-st'}>{compact && w ? TEXTO_SITUACAO[w.estado.situacao] : txt}</span>
        {!compact && w?.ligada && <span className="truncate text-[10px] opacity-75">📱 {w.ligada.celular.cor} · {w.ligada.vaga.rotulo}</span>}
      </button>
    );
  };
  return (
    <div className="desk">
      {L.centro.length > 0 && <div className="desk-center">{L.centro.map((p) => seat({ papel: p }, true))}</div>}
      {linhasDaMesa(L).map((r, i) => (
        <div className="desk-row" key={i}>
          <div className="flex min-w-0">{r.esq ? seat(r.esq) : <div className="ph" />}</div>
          <div className="desk-spine" aria-hidden="true" />
          <div className="flex min-w-0">{r.dir ? seat(r.dir) : <div className="ph" />}</div>
        </div>
      ))}
      {!compact && <div className="desk-sides"><span>Lado esquerdo</span><span /><span>Lado direito</span></div>}
      <div className="desk-foot">{L.rodape}</div>
    </div>
  );
}

/** Prévia do editor de espaços: mesma geometria, sem status. */
export function DeskPreview({ layout: L, onToggle }) {
  const cell = (pos) => {
    const k = posKey(pos);
    const off = !!L.desativadas?.[k];
    const code = montarCodigo(L, pos);
    return (
      <button key={k} type="button" className={`seat${off ? ' st-vazia' : ''} min-h-[54px]`} aria-pressed={off}
        aria-label={`${off ? 'Reativar' : 'Desativar'} a baia ${code}`} onClick={() => onToggle(k)}>
        <span className="s-code" style={{ color: off ? 'rgb(var(--mudo))' : undefined }}>{code}</span>
        <span className="s-st">{off ? 'Desativada' : 'Ativa'}</span>
      </button>
    );
  };
  return (
    <div className="desk">
      {L.centro.length > 0 && (
        <div className="desk-center">
          {L.centro.map((p) => (
            <div key={p} className="seat center st-aberto cursor-default min-h-[54px]">
              <span className="s-code">{montarCodigo(L, { papel: p })}</span><span className="s-st">{PAPEIS[p]}</span>
            </div>
          ))}
        </div>
      )}
      {linhasDaMesa(L).map((r, i) => (
        <div className="desk-row" key={i}>
          <div className="flex min-w-0">{r.esq ? cell(r.esq) : <div className="ph" />}</div>
          <div className="desk-spine" aria-hidden="true" />
          <div className="flex min-w-0">{r.dir ? cell(r.dir) : <div className="ph" />}</div>
        </div>
      ))}
      <div className="desk-sides"><span>Lado esquerdo</span><span /><span>Lado direito</span></div>
      <div className="desk-foot">{L.rodape}</div>
    </div>
  );
}
