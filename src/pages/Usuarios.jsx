import { useState } from 'react';
import { Plus, Search, Pencil } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { PERFIS, ACESSOS } from '../data/seed.js';
import { normalizar, iniciais } from '../lib/format.ts';
import { PageHead, Modal, Field, Pills } from '../components/ui.jsx';

function Editar({ u, onClose }) {
  const { st, actions, toast } = useStore();
  const [f, setF] = useState(u || { nome: '', user: '', cargo: '', perfil: 'supervisor', depto: 'Operacional', equipes: [], ativo: true });
  const usado = st.usuarios.some((x) => x.user === f.user.trim() && x.id !== f.id);
  const ok = f.nome.trim() && /^[a-z0-9._]{3,}$/.test(f.user.trim()) && !usado && f.cargo.trim();
  return (
    <Modal title={u ? `Editar ${u.nome}` : 'Novo usuário'} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>Cancelar</button>
      <button type="button" className="btn btn-primary" disabled={!ok} onClick={() => { actions.salvarUsuario({ ...f, nome: f.nome.trim(), user: f.user.trim(), cargo: f.cargo.trim() }); toast(u ? 'Usuário atualizado.' : 'Usuário criado. A senha inicial é enviada por e-mail.'); onClose(); }}>Salvar</button></>}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-3">
        <Field label="Nome completo"><input className="input" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field>
        <Field label="Usuário" hint={usado ? 'Usuário já existe.' : 'minúsculas, ex.: nome.sobrenome'} hintTone={usado ? 'bad' : ''}><input className="input" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value.toLowerCase() })} /></Field>
        <Field label="Cargo"><input className="input" value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })} /></Field>
        <Field label="Departamento"><input className="input" value={f.depto} onChange={(e) => setF({ ...f, depto: e.target.value })} /></Field>
      </div>
      <div className="field">Perfil de acesso<Pills label="Perfil" value={f.perfil} onChange={(v) => setF({ ...f, perfil: v })} options={Object.entries(PERFIS).map(([k, p]) => ({ value: k, label: p.label }))} /></div>
      <div className="text-xs text-mudo">Acessos do perfil: {PERFIS[f.perfil].acessos.map((a) => ACESSOS[a]).join(' · ')}</div>
      {f.perfil === 'supervisor' && (
        <div className="field">Mesas sob responsabilidade (só vê e abre chamados dessas baias)
          <div className="flex flex-wrap items-center gap-1.5">{st.layouts.map((l) => {
            const on = f.equipes.includes(l.id);
            return <button key={l.id} type="button" className="pill" aria-pressed={on} onClick={() => setF({ ...f, equipes: on ? f.equipes.filter((x) => x !== l.id) : [...f.equipes, l.id] })}>{l.base}</button>;
          })}</div>
        </div>
      )}
      <label className="check"><input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Usuário ativo</label>
    </Modal>
  );
}

export default function Usuarios() {
  const { st } = useStore();
  const [q, setQ] = useState('');
  const [ed, setEd] = useState(undefined);
  const lista = st.usuarios.filter((u) => !q || normalizar(`${u.nome} ${u.user} ${u.cargo} ${u.depto}`).includes(normalizar(q)));
  return (
    <>
      <PageHead title="Usuários" desc="Quem acessa o sistema, com perfil e mesas de cada supervisor.">
        <button type="button" className="btn btn-primary" onClick={() => setEd(null)}><Plus size={16} /> Novo usuário</button>
      </PageHead>
      <div className="search-wrap max-w-[360px]"><Search size={16} /><input className="input input-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, usuário ou cargo" aria-label="Buscar usuário" /></div>
      <div className="card card-pad-0 table-wrap">
        <table className="table min-w-[760px]">
          <thead><tr><th>Nome</th><th>Usuário</th><th>Cargo</th><th>Perfil</th><th>Mesas</th><th>Status</th><th /></tr></thead>
          <tbody>{lista.map((u) => (
            <tr key={u.id}>
              <td><span className="flex items-center gap-2 flex-nowrap"><span className="avatar bg-marca-suave text-marca-txt w-[30px] h-[30px] text-[12px]">{iniciais(u.nome)}</span><b>{u.nome}</b></span></td>
              <td className="font-mono text-xs">{u.user}</td><td>{u.cargo}<div className="text-[11px] text-mudo">{u.depto}</div></td>
              <td>{PERFIS[u.perfil]?.label}</td><td className="text-xs">{u.equipes?.join(', ') || '—'}</td>
              <td><span className={`badge badge-sm ${u.ativo ? 'b-ok' : 'b-gray'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
              <td><button type="button" className="btn btn-sm btn-ghost" onClick={() => setEd(u)} aria-label={`Editar ${u.nome}`}><Pencil size={14} /></button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {ed !== undefined && <Editar u={ed} onClose={() => setEd(undefined)} />}
    </>
  );
}
