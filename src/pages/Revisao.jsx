import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArrowRightLeft, Sparkles, ClipboardCheck, PieChart } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { baiaCodigo, nomeUser } from '../store/selectors.js';
import { numeroChamado, idade, normalizar, DIA } from '../lib/format.js';
import { PageHead, Empty, Modal, Field, Note, Kpi, StatusBadge, Bars } from '../components/ui.jsx';

const STOP = new Set('a o e é de da do das dos em no na nos nas um uma para por com sem que se ao à os as não mais muito está esta este isso foi ser ter tem já desde operador baia problema'.split(' '));

function Promover({ c, onClose }) {
  const { st, actions, toast } = useStore();
  const subs = st.catalogo.flatMap((cat) => cat.subs.map((s) => ({ ...s, cat })));
  const [subId, setSubId] = useState(c.subId);
  const [nome, setNome] = useState(c.titulo.replace(/^.*Outros:\s*/, '').slice(0, 40));
  const [passos, setPassos] = useState('');
  const [flags, setFlags] = useState({ para: false, dano: false });
  const sub = subs.find((s) => s.id === subId);
  const ok = nome.trim().length >= 3 && !sub.sits.some((x) => normalizar(x.nome) === normalizar(nome.trim()));
  return (
    <Modal title="Promover a nova situação oficial" onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>Cancelar</button>
      <button type="button" className="btn btn-primary" disabled={!ok} onClick={() => { actions.promoverSituacao(c.id, { subId, nome: nome.trim(), passos: passos.split('\n').map((x) => x.trim()), flags }); toast(`“${nome.trim()}” agora é uma situação oficial de ${sub.nome}.`); onClose(); }}><Sparkles size={15} /> Criar situação</button></>}>
      <Note tipo="gray"><b>Texto original:</b> {c.descricao || c.titulo}</Note>
      <Field label="Categoria › tipo"><select className="select" value={subId} onChange={(e) => setSubId(e.target.value)}>{subs.map((s) => <option key={s.id} value={s.id}>{s.cat.nome} › {s.nome}</option>)}</select></Field>
      <Field label="Nome da situação" hint={!ok && nome.trim().length >= 3 ? 'Já existe uma situação com esse nome.' : 'Como o supervisor vai ver o botão.'} hintTone={!ok && nome.trim().length >= 3 ? 'bad' : ''}><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
      <Field label="Passos de triagem (um por linha, opcional)"><textarea className="textarea" rows={4} value={passos} onChange={(e) => setPassos(e.target.value)} placeholder={'Conferir se…\nReiniciar…'} /></Field>
      <div className="row">
        <label className="check"><input type="checkbox" checked={flags.para} onChange={(e) => setFlags({ ...flags, para: e.target.checked })} /> Deixa o operador parado (prioridade sobe)</label>
        <label className="check"><input type="checkbox" checked={flags.dano} onChange={(e) => setFlags({ ...flags, dano: e.target.checked })} /> É dano físico (foto em vez de triagem)</label>
      </div>
    </Modal>
  );
}

function Reclassificar({ c, onClose }) {
  const { st, actions, toast } = useStore();
  const [sitId, setSitId] = useState('');
  return (
    <Modal title={`Reclassificar ${numeroChamado(c.id)}`} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>Cancelar</button>
      <button type="button" className="btn btn-primary" disabled={!sitId} onClick={() => { actions.reclassificar(c.id, sitId); toast(`${numeroChamado(c.id)} reclassificado.`); onClose(); }}>Reclassificar</button></>}>
      <Note tipo="gray"><b>Texto:</b> {c.descricao || c.titulo}</Note>
      <Field label="Situação correta">
        <select className="select" value={sitId} onChange={(e) => setSitId(e.target.value)}>
          <option value="">Escolha…</option>
          {st.catalogo.map((cat) => cat.subs.map((s) => (
            <optgroup key={s.id} label={`${cat.nome} › ${s.nome}`}>{s.sits.filter((x) => !x.outros).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</optgroup>
          )))}
        </select>
      </Field>
    </Modal>
  );
}

export default function Revisao() {
  const { st, agora } = useStore();
  const { abrir } = useOutletContext();
  const [modal, setModal] = useState(null);
  const fila = st.chamados.filter((c) => c.outros && !c.outrosRevisado).sort((a, b) => a.criadoEm - b.criadoEm);
  const mes = st.chamados.filter((c) => c.criadoEm >= agora - 30 * DIA);
  const outrosMes = mes.filter((c) => c.outros);
  const pct = mes.length ? Math.round((outrosMes.length / mes.length) * 100) : 0;
  const palavras = useMemo(() => {
    const m = {};
    st.chamados.filter((c) => c.outros).forEach((c) => {
      normalizar(`${c.descricao} ${c.titulo.replace(/^.*Outros:/, '')}`).split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w)).forEach((w) => { m[w] = (m[w] || 0) + 1; });
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [st.chamados]);
  const porSub = useMemo(() => {
    const m = {};
    outrosMes.forEach((c) => { m[c.sub] = (m[c.sub] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [outrosMes]);

  return (
    <>
      <PageHead title="Revisão de “Outros”" desc="“Outros” não pode virar gaveta. Reclassifique cada chamado e, quando o mesmo problema se repetir, promova o texto a uma situação oficial com um clique — o catálogo cresce com o uso real." />
      <div className="grid-kpi">
        <Kpi icon={ClipboardCheck} label="Na fila" valor={fila.length} destaque={fila.length > 0} sub="Aguardando reclassificação" />
        <Kpi icon={PieChart} label="“Outros” nos últimos 30 dias" valor={`${pct}%`} sub={`${outrosMes.length} de ${mes.length} chamados · meta: abaixo de 10%`} />
      </div>
      <div className="split">
        <section className="main stack">
          {!fila.length && <Empty icon={ClipboardCheck} title="Fila vazia">Todos os chamados em “Outros” já foram revisados.</Empty>}
          {fila.map((c) => (
            <div key={c.id} className="card stack-sm">
              <div className="row-between">
                <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 0 }} onClick={() => abrir({ ch: c.id })}><b>{numeroChamado(c.id)}</b></button>
                <span className="row"><StatusBadge status={c.status} sm /><span className="small muted">{idade(c.criadoEm, agora)}</span></span>
              </div>
              <span className="small muted">{c.categoria} › {c.sub} · {c.layoutId ? baiaCodigo(st, c.layoutId, c.pos) : c.local || 'sem baia'} · {nomeUser(st, c.remetenteId)}</span>
              <p style={{ background: 'var(--surface-2)', padding: '10px 12px', borderRadius: 10, whiteSpace: 'pre-line' }}>{c.descricao || c.titulo}</p>
              <div className="row">
                <button type="button" className="btn" onClick={() => setModal({ t: 'reclass', c })}><ArrowRightLeft size={15} /> Reclassificar</button>
                <button type="button" className="btn btn-primary" onClick={() => setModal({ t: 'promover', c })}><Sparkles size={15} /> Promover a nova situação</button>
              </div>
            </div>
          ))}
        </section>
        <aside className="side stack">
          <section className="card stack-sm">
            <div className="card-title">Palavras mais frequentes (RF48)</div>
            {palavras.length ? <Bars dados={palavras} cor="var(--warn-dot)" /> : <span className="small muted">Sem dados.</span>}
            <span className="tiny muted">Palavras que se repetem são candidatas a nova situação.</span>
          </section>
          <section className="card stack-sm">
            <div className="card-title">“Outros” por tipo (30 dias)</div>
            {porSub.length ? <Bars dados={porSub} /> : <span className="small muted">Sem dados.</span>}
          </section>
        </aside>
      </div>
      {modal?.t === 'promover' && <Promover c={modal.c} onClose={() => setModal(null)} />}
      {modal?.t === 'reclass' && <Reclassificar c={modal.c} onClose={() => setModal(null)} />}
    </>
  );
}
