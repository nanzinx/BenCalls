import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ShieldAlert, Lock, Gavel, Paperclip } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { baiaCodigo, codigoItem, nomeItem, nomeUser } from '../store/selectors.js';
import { numeroChamado, dataCurta, dataHora } from '../lib/format.js';
import { PageHead, Pills, Modal, Note, Kpi, Empty } from '../components/ui.jsx';

const COR = { 'Aguardando RH': 'b-warn', Procedente: 'b-bad', Improcedente: 'b-ok' };

function Dossie({ d, onClose }) {
  const { st, actions, toast } = useStore();
  const { abrir } = useOutletContext();
  const c = st.chamados.find((x) => x.id === d.ticketId);
  const it = st.itens.find((x) => x.id === d.assetId);
  const termo = st.termos[`${d.layoutId}:${d.pos}`];
  const [just, setJust] = useState('');
  return (
    <Modal size="lg" title={`Dossiê ${d.id.toUpperCase()} · ${d.ocupante}`} onClose={onClose}>
      <Note tipo="gray" icon={Lock}>Dado pessoal protegido (LGPD): visível só para RH e gestão. Cada acesso e decisão fica na auditoria.</Note>
      <div className="detail-grid">
        <div><div className="lbl">Colaborador (ocupante na abertura)</div><div className="val">{d.ocupante}</div></div>
        <div><div className="lbl">Baia</div><div className="val">{baiaCodigo(st, d.layoutId, d.pos)}</div></div>
        <div><div className="lbl">Chamado</div><div className="val"><button type="button" className="btn btn-sm btn-ghost" style={{ padding: 0, minHeight: 0 }} onClick={() => { onClose(); abrir({ ch: d.ticketId }); }}>{numeroChamado(d.ticketId)}</button></div></div>
        <div><div className="lbl">Item</div><div className="val">{it ? `${nomeItem(it.tipo)} · ${it.id} · ${it.modelo}` : '—'}</div></div>
        <div><div className="lbl">Laudo técnico</div><div className="val" style={{ color: 'var(--bad)' }}>{c?.solucao?.causa || '—'} · {c?.solucao ? nomeUser(st, c.solucao.user) : ''}</div></div>
        <div><div className="lbl">Termo de responsabilidade</div><div className="val">{termo?.assinadoEm ? `Assinado em ${dataCurta(termo.assinadoEm)}` : <span style={{ color: 'var(--orange)' }}>Sem termo assinado</span>}</div></div>
      </div>
      {c && (
        <div className="stack-sm">
          <span className="small bold muted">Descrição e solução</span>
          {c.descricao && <p>{c.descricao}</p>}
          {c.solucao && <p><b>Solução:</b> {c.solucao.texto}</p>}
          <div className="row">{c.anexos.map((a) => <span key={a} className="badge b-blue"><Paperclip size={12} /> {a}</span>)}{!c.anexos.length && <span className="small muted">Sem fotos anexadas.</span>}</div>
          {it && <span className="small muted">Histórico do item: {it.hist.length} registros · etiqueta atual {codigoItem(st, it)}</span>}
        </div>
      )}
      {!termo?.assinadoEm && <Note tipo="warn">Sem termo assinado, o registro de “como recebeu” não existe. Considere isso na decisão.</Note>}
      {d.decisao ? (
        <Note tipo={d.status === 'Procedente' ? 'bad' : 'ok'} icon={Gavel}><b>{d.status}</b> · {nomeUser(st, d.decisao.user)} · {dataHora(d.decisao.at)}<br />{d.decisao.just}</Note>
      ) : (
        <div className="card card-flat stack-sm" style={{ background: 'var(--surface-2)' }}>
          <label className="field">Decisão do RH (RF21)
            <textarea className="textarea" rows={3} value={just} onChange={(e) => setJust(e.target.value)} placeholder="Fundamente a decisão (termo, fotos, laudo, conversa com o colaborador)…" />
          </label>
          <span className="small muted">O sistema não aplica desconto em folha: só registra a decisão (RN03).</span>
          <div className="row">
            <button type="button" className="btn btn-danger" disabled={just.trim().length < 10} onClick={() => { actions.decidirDossie(d.id, 'Procedente', just.trim()); toast('Dossiê marcado como procedente.'); onClose(); }}>Procedente</button>
            <button type="button" className="btn btn-ok" disabled={just.trim().length < 10} onClick={() => { actions.decidirDossie(d.id, 'Improcedente', just.trim()); toast('Dossiê marcado como improcedente.'); onClose(); }}>Improcedente</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Dossies() {
  const { st } = useStore();
  const [filtro, setFiltro] = useState('Aguardando RH');
  const [sel, setSel] = useState(null);
  const lista = st.dossies.filter((d) => filtro === 'Todos' || d.status === filtro);
  const n = (s) => st.dossies.filter((d) => d.status === s).length;
  return (
    <>
      <PageHead title="Dossiês do RH" desc="Gerados automaticamente quando o laudo técnico aponta “mau uso”. Reúnem chamado, laudo, fotos, ocupante e termo assinado. A decisão é humana." />
      <div className="grid-kpi">
        <Kpi icon={ShieldAlert} label="Aguardando análise" valor={n('Aguardando RH')} destaque={n('Aguardando RH') > 0} />
        <Kpi icon={Gavel} label="Procedentes" valor={n('Procedente')} />
        <Kpi icon={Gavel} label="Improcedentes" valor={n('Improcedente')} />
      </div>
      <Pills label="Filtro" value={filtro} onChange={setFiltro} options={['Aguardando RH', 'Procedente', 'Improcedente', 'Todos']} />
      {!lista.length ? <Empty icon={ShieldAlert} title="Nenhum dossiê aqui" /> : (
        <div className="card card-pad-0 table-wrap">
          <table className="table" style={{ minWidth: 680 }}>
            <thead><tr><th>Dossiê</th><th>Colaborador</th><th>Baia</th><th>Chamado</th><th>Criado</th><th>Situação</th></tr></thead>
            <tbody>{lista.map((d) => (
              <tr key={d.id} className="clickable" tabIndex={0} onClick={() => setSel(d.id)} onKeyDown={(e) => e.key === 'Enter' && setSel(d.id)}>
                <td className="bold">{d.id.toUpperCase()}</td><td>{d.ocupante}</td><td className="mono">{baiaCodigo(st, d.layoutId, d.pos)}</td>
                <td>{numeroChamado(d.ticketId)}</td><td className="small">{dataCurta(d.criadoEm)}</td>
                <td><span className={`badge badge-sm ${COR[d.status]}`}>{d.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {sel && <Dossie d={st.dossies.find((x) => x.id === sel)} onClose={() => setSel(null)} />}
    </>
  );
}
