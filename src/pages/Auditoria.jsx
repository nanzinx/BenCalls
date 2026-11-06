import { useState } from 'react';
import { Search, Download, Lock } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { nomeUser } from '../store/selectors.js';
import { dataHora, normalizar } from '../lib/format.ts';
import { baixarCsv } from '../lib/csv.ts';
import { PageHead, Note } from '../components/ui.jsx';

/** RN08: toda ação sensível fica registrada (quem, quando, o quê) e não pode ser apagada. */
export default function Auditoria() {
  const { st, agora } = useStore();
  const [q, setQ] = useState('');
  const lista = st.auditoria.filter((a) => !q || normalizar(`${a.acao} ${a.alvo} ${a.detalhe} ${nomeUser(st, a.user)}`).includes(normalizar(q)));
  return (
    <>
      <PageHead title="Auditoria" desc="Tudo o que foi feito no sistema, por quem e quando. Não pode ser alterado.">
        <button type="button" className="btn" onClick={() => baixarCsv('auditoria', ['Quando', 'Usuário', 'Ação', 'Alvo', 'Detalhe'], lista.map((a) => [new Date(a.at).toLocaleString('pt-BR'), nomeUser(st, a.user), a.acao, a.alvo, a.detalhe]))}><Download size={15} /> Exportar</button>
      </PageHead>
      <Note tipo="gray" icon={Lock}>Somente leitura: nenhum perfil edita ou apaga registros.</Note>
      <div className="search-wrap max-w-[420px]"><Search size={16} /><input className="input input-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por ação, usuário, chamado, item…" aria-label="Filtrar auditoria" /></div>
      <div className="card card-pad-0 table-wrap">
        <table className="table min-w-[720px]">
          <thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Alvo</th><th>Detalhe</th></tr></thead>
          <tbody>{lista.slice(0, 300).map((a) => (
            <tr key={a.id}><td className="text-xs whitespace-nowrap">{dataHora(a.at, agora)}</td><td>{nomeUser(st, a.user)}</td><td><b>{a.acao}</b></td><td className="font-mono text-xs">{a.alvo}</td><td className="text-xs text-mudo">{a.detalhe}</td></tr>
          ))}</tbody>
        </table>
        {!lista.length && <div className="text-xs text-mudo p-4">Nenhum registro.</div>}
      </div>
    </>
  );
}
