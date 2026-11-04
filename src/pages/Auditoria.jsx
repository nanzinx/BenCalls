import { useState } from 'react';
import { Search, Download, Lock } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { nomeUser } from '../store/selectors.js';
import { dataHora, normalizar } from '../lib/format.js';
import { baixarCsv } from '../lib/csv.js';
import { PageHead, Note } from '../components/ui.jsx';

/** RN08: toda ação sensível fica registrada (quem, quando, o quê) e não pode ser apagada. */
export default function Auditoria() {
  const { st, agora } = useStore();
  const [q, setQ] = useState('');
  const lista = st.auditoria.filter((a) => !q || normalizar(`${a.acao} ${a.alvo} ${a.detalhe} ${nomeUser(st, a.user)}`).includes(normalizar(q)));
  return (
    <>
      <PageHead title="Auditoria" desc="Registro imutável das ações: aberturas, mudanças de status, laudos, movimentações de estoque, decisões do RH, alterações de catálogo, tema e acessos.">
        <button type="button" className="btn" onClick={() => baixarCsv('auditoria', ['Quando', 'Usuário', 'Ação', 'Alvo', 'Detalhe'], lista.map((a) => [new Date(a.at).toLocaleString('pt-BR'), nomeUser(st, a.user), a.acao, a.alvo, a.detalhe]))}><Download size={15} /> Exportar</button>
      </PageHead>
      <Note tipo="gray" icon={Lock}>Somente leitura. Na versão final o registro é gravado pela API (não pelo navegador) e nenhum perfil consegue editar ou apagar.</Note>
      <div className="search-wrap" style={{ maxWidth: 420 }}><Search size={16} /><input className="input input-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por ação, usuário, chamado, item…" aria-label="Filtrar auditoria" /></div>
      <div className="card card-pad-0 table-wrap">
        <table className="table" style={{ minWidth: 720 }}>
          <thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Alvo</th><th>Detalhe</th></tr></thead>
          <tbody>{lista.slice(0, 300).map((a) => (
            <tr key={a.id}><td className="small" style={{ whiteSpace: 'nowrap' }}>{dataHora(a.at, agora)}</td><td>{nomeUser(st, a.user)}</td><td><b>{a.acao}</b></td><td className="mono small">{a.alvo}</td><td className="small muted">{a.detalhe}</td></tr>
          ))}</tbody>
        </table>
        {!lista.length && <div className="small muted" style={{ padding: 16 }}>Nenhum registro.</div>}
      </div>
    </>
  );
}
