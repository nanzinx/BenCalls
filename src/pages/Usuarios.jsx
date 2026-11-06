import { useState } from 'react';
import { Plus, Search, Pencil, KeyRound, Copy, Check } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { PERFIS, ACESSOS } from '../data/seed.js';
import { acessosDe } from '../store/selectors.js';
import { normalizar, iniciais } from '../lib/format.ts';
import { PageHead, Modal, Field, Pills, Note } from '../components/ui.jsx';

/** Senha provisória legível (sem 0/O, 1/l), gerada no navegador com crypto. */
function senhaProvisoria() {
  const alfa = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const n = crypto.getRandomValues(new Uint32Array(10));
  const s = Array.from(n, (x) => alfa[x % alfa.length]).join('');
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

function SenhaGerada({ usuario, senha, onClose }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Modal title="Login pronto" onClose={onClose} footer={<button type="button" className="btn btn-primary" onClick={onClose}>Concluir</button>}>
      <p className="text-tinta-2">Passe estes dados para a pessoa. A senha é provisória: ela troca no primeiro acesso.</p>
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 rounded-xl bg-superficie-2 px-4 py-3.5">
        <span className="text-xs text-mudo">Usuário</span><b className="font-mono">{usuario}</b>
        <span className="text-xs text-mudo">Senha provisória</span>
        <span className="flex items-center gap-2">
          <b className="font-mono text-base tracking-wide">{senha}</b>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => { navigator.clipboard?.writeText(`${usuario} / ${senha}`); setCopiado(true); }}>
            {copiado ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
          </button>
        </span>
      </div>
      <Note tipo="gray">A senha não fica gravada em lugar nenhum desta tela. Na versão final ela é salva com hash pela API.</Note>
    </Modal>
  );
}

function Editar({ u, onClose, onSenha }) {
  const { st, user: eu, actions, toast } = useStore();
  const [f, setF] = useState(u || { nome: '', user: '', email: '', cargo: '', perfil: 'supervisor', depto: 'Operacional', equipes: [], ativo: true });
  const souEu = u && u.id === eu.id;
  const usado = st.usuarios.some((x) => x.user === f.user.trim() && x.id !== f.id);
  const ok = f.nome.trim() && /^[a-z0-9._]{3,}$/.test(f.user.trim()) && !usado && f.cargo.trim();
  const padrao = PERFIS[f.perfil].acessos;
  const atuais = acessosDe(f);
  const personalizado = !!f.acessos && f.acessos.slice().sort().join() !== padrao.slice().sort().join();
  const alternar = (a) => {
    const novo = atuais.includes(a) ? atuais.filter((x) => x !== a) : [...atuais, a];
    setF({ ...f, acessos: novo });
  };

  const salvar = () => {
    const dados = { ...f, nome: f.nome.trim(), user: f.user.trim(), cargo: f.cargo.trim(), email: (f.email || '').trim() };
    if (!personalizado) delete dados.acessos;
    if (!u) dados.trocaSenha = true;
    actions.salvarUsuario(dados);
    if (u) { toast('Usuário atualizado.'); onClose(); } else onSenha(dados.user, senhaProvisoria());
  };

  return (
    <Modal size="lg" title={u ? `Editar ${u.nome}` : 'Novo usuário'} onClose={onClose} footer={<>
      {u && <button type="button" className="btn btn-ghost mr-auto" onClick={() => { actions.redefinirSenha(u.id); onSenha(u.user, senhaProvisoria()); }}><KeyRound size={15} /> Redefinir senha</button>}
      <button type="button" className="btn" onClick={onClose}>Cancelar</button>
      <button type="button" className="btn btn-primary" disabled={!ok} onClick={salvar}>{u ? 'Salvar' : 'Criar login'}</button></>}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] items-start gap-3">
        <Field label="Nome completo"><input className="input" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field>
        <Field label="Usuário" hint={usado ? 'Usuário já existe.' : 'minúsculas, ex.: nome.sobrenome'} hintTone={usado ? 'bad' : ''}><input className="input" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value.toLowerCase() })} /></Field>
        <Field label="E-mail"><input className="input" type="email" value={f.email || ''} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="nome.sobrenome@benconsig.com" /></Field>
        <Field label="Cargo"><input className="input" value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })} /></Field>
        <Field label="Departamento"><input className="input" value={f.depto} onChange={(e) => setF({ ...f, depto: e.target.value })} /></Field>
      </div>
      <div className="field">Perfil
        <Pills label="Perfil" value={f.perfil} onChange={(v) => { const n = { ...f, perfil: v }; delete n.acessos; setF(n); }} options={Object.entries(PERFIS).map(([k, p]) => ({ value: k, label: p.label }))} />
      </div>
      {f.perfil === 'supervisor' && (
        <div className="field">Mesas sob responsabilidade (só vê e abre chamados dessas baias)
          <div className="flex flex-wrap items-center gap-1.5">{st.layouts.map((l) => {
            const on = f.equipes.includes(l.id);
            return <button key={l.id} type="button" className="pill" aria-pressed={on} onClick={() => setF({ ...f, equipes: on ? f.equipes.filter((x) => x !== l.id) : [...f.equipes, l.id] })}>{l.base}</button>;
          })}</div>
        </div>
      )}
      <details className="group rounded-xl border border-linha" open={personalizado || undefined}>
        <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-[13px] font-semibold text-tinta-2">
          <span>Acessos {personalizado ? <span className="badge badge-sm b-warn ml-1">personalizado</span> : <span className="ml-1 font-normal text-mudo">· padrão do perfil</span>}</span>
          {personalizado && <button type="button" className="btn btn-sm btn-ghost" onClick={(e) => { e.preventDefault(); const n = { ...f }; delete n.acessos; setF(n); }}>Voltar ao padrão</button>}
        </summary>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-4 gap-y-2 px-3.5 pb-3.5">
          {Object.entries(ACESSOS).map(([k, nome]) => {
            const travado = souEu && k === 'CU';
            return (
              <label key={k} className="check text-[13px]" title={travado ? 'Você não pode tirar o seu próprio acesso a Usuários' : undefined}>
                <input type="checkbox" checked={atuais.includes(k)} disabled={travado} onChange={() => alternar(k)} /> {nome}
              </label>
            );
          })}
        </div>
      </details>
      <label className="check" title={souEu ? 'Você não pode desativar o seu próprio login' : undefined}>
        <input type="checkbox" checked={f.ativo} disabled={souEu} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Login ativo
      </label>
    </Modal>
  );
}

export default function Usuarios() {
  const { st } = useStore();
  const [q, setQ] = useState('');
  const [ed, setEd] = useState(undefined);
  const [senha, setSenha] = useState(null);
  const lista = st.usuarios.filter((u) => !q || normalizar(`${u.nome} ${u.user} ${u.cargo} ${u.depto}`).includes(normalizar(q)));
  return (
    <>
      <PageHead title="Usuários" desc="Logins, perfis e acessos de cada pessoa.">
        <button type="button" className="btn btn-primary" onClick={() => setEd(null)}><Plus size={16} /> Novo login</button>
      </PageHead>
      <div className="search-wrap max-w-[360px]"><Search size={16} /><input className="input input-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, usuário ou cargo" aria-label="Buscar usuário" /></div>
      <div className="card card-pad-0 table-wrap">
        <table className="table min-w-[760px]">
          <thead><tr><th>Nome</th><th>Usuário</th><th>Cargo</th><th>Perfil</th><th>Mesas</th><th>Status</th><th /></tr></thead>
          <tbody>{lista.map((u) => (
            <tr key={u.id} className="clickable" onClick={() => setEd(u)}>
              <td><span className="flex flex-nowrap items-center gap-2"><span className="avatar size-[30px] bg-marca-suave text-[12px] text-marca-txt">{iniciais(u.nome)}</span><b>{u.nome}</b></span></td>
              <td className="font-mono text-xs">{u.user}</td><td>{u.cargo}<div className="text-[11px] text-mudo">{u.depto}</div></td>
              <td>{PERFIS[u.perfil]?.label}{u.acessos && <span className="badge badge-sm b-warn ml-1.5">personalizado</span>}</td>
              <td className="text-xs">{u.equipes?.join(', ') || '—'}</td>
              <td>
                <span className={`badge badge-sm ${u.ativo ? 'b-ok' : 'b-gray'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span>
                {u.trocaSenha && <span className="badge badge-sm b-blue ml-1.5">senha provisória</span>}
              </td>
              <td><button type="button" className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); setEd(u); }} aria-label={`Editar ${u.nome}`}><Pencil size={14} /></button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {ed !== undefined && <Editar u={ed} onClose={() => setEd(undefined)} onSenha={(usuario, s) => { setEd(undefined); setSenha({ usuario, s }); }} />}
      {senha && <SenhaGerada usuario={senha.usuario} senha={senha.s} onClose={() => setSenha(null)} />}
    </>
  );
}
