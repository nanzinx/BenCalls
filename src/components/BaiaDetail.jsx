import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, PlusCircle, UserCog, FileSignature, History } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { baiaCodigo, codigoItem, itensDaBaia, layoutById, nomeItem, statusBaia, tem, layoutsDoUsuario } from '../store/selectors.js';
import { dataCurta, dataHora, numeroChamado, idade } from '../lib/format.ts';
import { ItemBadge, StatusBadge } from './ui.jsx';

export const ST_BAIA = {
  ok: { label: 'OK', dot: 'rgb(var(--ok-ponto))' },
  aberto: { label: 'Chamado aberto', dot: 'rgb(var(--aviso-ponto))' },
  parado: { label: 'Operador parado', dot: 'rgb(var(--ruim-ponto))' },
  vazia: { label: 'Vazia', dot: 'rgb(var(--cinza-ponto))' }
};

/** RF17: histórico completo da baia — chamados, trocas e ocupantes. */
export default function BaiaDetail({ chave, onClose, abrir }) {
  const { st, user, actions, toast, agora } = useStore();
  const nav = useNavigate();
  const [layoutId, pos] = chave.split(':');
  const L = layoutById(st, layoutId);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState('');
  const [turno, setTurno] = useState('Manhã');
  if (!L) return null;
  const code = baiaCodigo(st, layoutId, pos);
  const oc = st.ocupacao[chave];
  const status = statusBaia(st, layoutId, pos);
  const itens = itensDaBaia(st, layoutId, pos);
  const chamados = st.chamados.filter((c) => c.layoutId === layoutId && c.pos === pos).sort((a, b) => b.criadoEm - a.criadoEm);
  const ocupantes = st.ocupHist.filter((h) => h.key === chave).sort((a, b) => b.inicio - a.inicio);
  const trocas = st.itens.flatMap((i) => i.hist.filter((h) => h.txt.includes(`${code}-`) && /→/.test(h.txt)).map((h) => ({ ...h, id: i.id }))).sort((a, b) => b.at - a.at);
  const minhaMesa = layoutsDoUsuario(st, user).some((l) => l.id === layoutId);
  const podeOcupacao = (user.perfil === 'supervisor' && minhaMesa) || tem(user, 'ASC') || user.perfil === 'gestor';
  const termo = st.termos[chave];
  const papel = ['SUP', 'SUB', 'LID'].includes(pos);

  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap justify-between gap-3 items-start">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-mudo">{L.sala} · {L.nome}</span>
          <h2 className="font-mono text-[22px] text-marca-txt">{code}</h2>
          <span className="flex flex-wrap items-center gap-2 text-xs"><span className="dot" style={{ background: ST_BAIA[status].dot }} /> {ST_BAIA[status].label}</span>
        </div>
        <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
      </div>

      <div className="detail-grid">
        <div><div className="lbl">Ocupante agora</div><div className="val">{oc?.nome || 'Sem ocupante'}</div></div>
        <div><div className="lbl">Desde</div><div className="val">{oc ? `${dataCurta(oc.desde)} · turno ${oc.turno}` : '—'}</div></div>
        {st.modulos.termo && !papel && (
          <div className="col-span-full"><div className="lbl">Termo de responsabilidade</div><div className="val">
            {termo ? termo.assinadoEm ? <span className="badge badge-sm b-ok">Assinado em {dataCurta(termo.assinadoEm)}</span> : <span className="badge badge-sm b-warn">Aguardando aceite de {termo.ocupante}</span> : <span className="text-mudo">—</span>}
          </div></div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tem(user, 'RC') && minhaMesa && <button type="button" className="btn btn-primary" onClick={() => nav(`/novo?baia=${encodeURIComponent(chave)}`)}><PlusCircle size={15} /> Abrir chamado nesta baia</button>}
        {podeOcupacao && <button type="button" className="btn" onClick={() => { setEditando(true); setNome(''); }}><UserCog size={15} /> Trocar ocupante</button>}
        {st.modulos.termo && termo && tem(user, 'TERMO') && <button type="button" className="btn" onClick={() => nav(`/termos?baia=${encodeURIComponent(chave)}`)}><FileSignature size={15} /> Ver termo</button>}
      </div>

      {editando && (
        <div className="card card-flat flex flex-col gap-1.5 bg-superficie-2">
          <span className="text-xs font-semibold">Registrar nova ocupação</span>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do operador (vazio = baia desocupada)" autoFocus />
          <div className="flex flex-wrap items-center gap-1.5">
            {['Manhã', 'Tarde', 'Noite', 'Integral'].map((t) => <button key={t} type="button" className="pill" aria-pressed={turno === t} onClick={() => setTurno(t)}>{t}</button>)}
          </div>
          {st.modulos.termo && <span className="text-xs text-mudo">Um novo termo com os itens da baia é gerado para o aceite do operador.</span>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary" onClick={() => { actions.trocarOcupante(layoutId, pos, nome, turno); setEditando(false); toast(nome.trim() ? `${nome.trim()} agora ocupa ${code}.` : `${code} marcada como vazia.`); }}>Salvar</button>
            <button type="button" className="btn" onClick={() => setEditando(false)}>Voltar</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-mudo">Itens instalados</span>
        {itens.map((i) => (
          <button key={i.id} type="button" className="ticket py-2 px-2.5 flex-row items-center" onClick={() => tem(user, 'EST') && abrir({ item: i.id })} disabled={!tem(user, 'EST')}>
            <span className="tag">{codigoItem(st, i)}</span>
            <span className="min-w-0 flex-auto"><b>{nomeItem(i.tipo)}</b> <span className="text-xs text-mudo">{i.modelo} · {i.id}</span></span>
            <ItemBadge status={i.status} />
          </button>
        ))}
        {!itens.length && <span className="text-xs text-mudo">Nenhum item cadastrado nesta baia.</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-mudo">Chamados da baia ({chamados.length})</span>
        {chamados.slice(0, 8).map((c) => (
          <button key={c.id} type="button" className="ticket py-2 px-2.5" onClick={() => abrir({ ch: c.id })}>
            <span className="t-top"><span className="t-num">{numeroChamado(c.id)} · {idade(c.criadoEm, agora)} · {c.ocupante}</span><StatusBadge status={c.status} sm /></span>
            <span className="text-xs">{c.titulo}</span>
          </button>
        ))}
        {!chamados.length && <span className="text-xs text-mudo">Nenhum chamado registrado.</span>}
      </div>

      {trocas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-mudo">Trocas de itens</span>
          {trocas.slice(0, 8).map((h, k) => <div key={k} className="text-xs"><b className="font-mono">{h.id}</b> · {h.txt} <span className="text-mudo">· {dataHora(h.at, agora)}</span></div>)}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-mudo flex flex-wrap items-center gap-2"><History size={14} /> Ocupantes</span>
        {ocupantes.map((h, k) => (
          <div key={k} className="flex flex-wrap items-center gap-2 text-xs"><b>{h.nome}</b><span className="text-mudo">{dataCurta(h.inicio)} → {h.fim ? dataCurta(h.fim) : 'atual'}</span></div>
        ))}
        {!ocupantes.length && <span className="text-xs text-mudo">Sem registro de ocupação.</span>}
      </div>
    </div>
  );
}
