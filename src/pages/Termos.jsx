import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileSignature, Printer, Search, PenLine } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { baiaCodigo, codigoItem, itensDaBaia, layoutById, layoutsDoUsuario, nomeItem } from '../store/selectors.js';
import { dataCurta, normalizar } from '../lib/format.ts';
import { PageHead, Pills, Modal, Note, Kpi, Empty } from '../components/ui.jsx';

function TermoDoc({ chave, onClose }) {
  const { st, actions, toast } = useStore();
  const t = st.termos[chave];
  const [layoutId, pos] = chave.split(':');
  const L = layoutById(st, layoutId);
  const itens = itensDaBaia(st, layoutId, pos);
  const [nome, setNome] = useState('');
  const confere = normalizar(nome.trim()) === normalizar(t.ocupante);
  return (
    <Modal size="lg" title={`Termo de responsabilidade · ${baiaCodigo(st, layoutId, pos)}`} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={() => window.print()}><Printer size={15} /> Imprimir</button>
      {!t.assinadoEm && <button type="button" className="btn btn-primary" disabled={!confere} onClick={() => { actions.assinarTermo(chave); toast(`Termo assinado por ${t.ocupante}.`); onClose(); }}><PenLine size={15} /> Registrar aceite</button>}
    </>}>
      <div className="stack" style={{ lineHeight: 1.6 }}>
        <div className="row-between">
          <b style={{ fontSize: 16 }}>{st.tema.empresa} · Termo de entrega de equipamentos</b>
          <span className="small muted">Versão {t.versao} · gerado em {dataCurta(t.geradoEm)}</span>
        </div>
        <p>Eu, <b>{t.ocupante}</b>, recebo para uso na posição <b>{baiaCodigo(st, layoutId, pos)}</b> ({L.sala} · {L.nome}) os equipamentos abaixo, no estado descrito, e me comprometo a zelar pelo seu bom uso.</p>
        <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 10 }}>
          <table className="table">
            <thead><tr><th>Etiqueta</th><th>Patrimônio</th><th>Item</th><th>Estado na entrega</th></tr></thead>
            <tbody>{itens.map((i) => <tr key={i.id}><td className="mono bold">{codigoItem(st, i)}</td><td className="mono">{i.id}</td><td>{nomeItem(i.tipo)} · {i.modelo}</td><td>{i.status === 'Novo' ? 'Novo' : 'Em uso, funcionando, sem avarias aparentes'}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="small">Defeitos causados por desgaste natural, defeito de fábrica ou problemas da baia <b>não</b> são de responsabilidade do colaborador. Danos só são analisados com laudo técnico do TI e decisão do RH; o sistema não aplica descontos.</p>
        <Note tipo="warn">Texto de exemplo. Antes de usar em produção, validar com o RH/jurídico (CLT, art. 462, §1º: desconto por dano só quando previsto em acordo).</Note>
        {t.assinadoEm ? (
          <Note tipo="ok">Aceite digital registrado por <b>{t.ocupante}</b> em {dataCurta(t.assinadoEm)}. O registro fica na auditoria e não pode ser apagado.</Note>
        ) : (
          <label className="field">Para registrar o aceite, o operador digita o próprio nome completo
            <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t.ocupante} />
            <span className={`hint ${confere ? 'ok' : ''}`}>{confere ? 'Nome confere.' : 'O nome precisa ser igual ao do ocupante cadastrado.'}</span>
          </label>
        )}
      </div>
    </Modal>
  );
}

export default function Termos() {
  const { st, user } = useStore();
  const [sp, setSp] = useSearchParams();
  const [filtro, setFiltro] = useState('pendentes');
  const [q, setQ] = useState('');
  const mesas = new Set(layoutsDoUsuario(st, user).map((l) => l.id));
  const lista = useMemo(() => Object.entries(st.termos)
    .filter(([k]) => mesas.has(k.split(':')[0]))
    .map(([k, t]) => ({ k, ...t, code: baiaCodigo(st, ...k.split(':')) }))
    .filter((t) => (filtro === 'todos' || (filtro === 'pendentes' ? !t.assinadoEm : !!t.assinadoEm)) && (!q || normalizar(`${t.code} ${t.ocupante}`).includes(normalizar(q))))
    .sort((a, b) => a.code.localeCompare(b.code)), [st, filtro, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const todos = Object.entries(st.termos).filter(([k]) => mesas.has(k.split(':')[0]));
  const pend = todos.filter(([, t]) => !t.assinadoEm).length;
  const aberto = sp.get('baia');

  return (
    <>
      <PageHead title="Termos de responsabilidade" desc="Ao assumir uma baia, o operador confirma o checklist dos itens (patrimônio e estado). Esse é o registro de “como recebeu”, que dá sustentação ao laudo e ao dossiê." />
      <div className="grid-kpi">
        <Kpi icon={FileSignature} label="Aguardando aceite" valor={pend} destaque={pend > 0} onClick={() => setFiltro('pendentes')} />
        <Kpi icon={FileSignature} label="Assinados" valor={todos.length - pend} onClick={() => setFiltro('assinados')} />
      </div>
      <div className="row-between">
        <Pills label="Filtro" value={filtro} onChange={setFiltro} options={[{ value: 'pendentes', label: 'Aguardando aceite' }, { value: 'assinados', label: 'Assinados' }, { value: 'todos', label: 'Todos' }]} />
        <div className="search-wrap" style={{ minWidth: 240 }}><Search size={16} /><input className="input input-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Baia ou operador" aria-label="Buscar termo" /></div>
      </div>
      {!lista.length ? <Empty title="Nenhum termo aqui" /> : (
        <div className="card card-pad-0 table-wrap">
          <table className="table">
            <thead><tr><th>Baia</th><th>Operador</th><th>Gerado em</th><th>Situação</th><th /></tr></thead>
            <tbody>{lista.map((t) => (
              <tr key={t.k} className="clickable" onClick={() => setSp({ baia: t.k })}>
                <td className="mono bold">{t.code}</td><td>{t.ocupante}</td><td className="small">{dataCurta(t.geradoEm)}</td>
                <td>{t.assinadoEm ? <span className="badge badge-sm b-ok">Assinado em {dataCurta(t.assinadoEm)}</span> : <span className="badge badge-sm b-warn">Aguardando aceite</span>}</td>
                <td><button type="button" className="btn btn-sm">{t.assinadoEm ? 'Ver' : 'Colher aceite'}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {aberto && st.termos[aberto] && <TermoDoc chave={aberto} onClose={() => setSp({})} />}
    </>
  );
}
