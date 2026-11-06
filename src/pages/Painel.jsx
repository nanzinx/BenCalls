import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { KanbanSquare, List, Search, Flame, AlertTriangle, ClipboardCheck, UserCheck, Timer } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { baiaCodigo, nomeUser } from '../store/selectors.js';
import { ABERTOS, PRIORIDADES, slaInfo } from '../lib/rules.ts';
import { normalizar, numeroChamado, idade } from '../lib/format.ts';
import { PageHead, Seg, Pills, Empty, StatusBadge, PrioBadge, Sla, Kpi, AjudaSla } from '../components/ui.jsx';
import TicketCard from '../components/TicketCard.jsx';
import { BannerIncidentes } from './MeusChamados.jsx';

const COLS = ['Em Análise', 'Pendente', 'Em Execução', 'Aguardando Consenso'];

export default function Painel() {
  const { st, user, agora } = useStore();
  const { abrir } = useOutletContext();
  const [vis, setVis] = useState(() => localStorage.getItem('bencalls:painel') || 'kanban');
  const [q, setQ] = useState('');
  const [prio, setPrio] = useState('Todas');
  const [depto, setDepto] = useState('Todos');
  const [flag, setFlag] = useState('todos');

  const abertos = useMemo(() => st.chamados.filter((c) => ABERTOS.includes(c.status)), [st.chamados]);
  const info = (c) => slaInfo(c, agora);
  const filtrados = useMemo(() => {
    const nq = normalizar(q);
    return abertos.filter((c) => {
      if (prio !== 'Todas' && c.prioridade !== prio) return false;
      if (depto !== 'Todos' && c.depto !== depto) return false;
      if (flag === 'meus' && c.tecnicoId !== user.id) return false;
      if (flag === 'sla' && !(info(c).nivel !== 'ok' && !info(c).pausado)) return false;
      if (flag === 'alerta' && !c.alerta) return false;
      if (flag === 'outros' && !(c.outros && !c.outrosRevisado)) return false;
      if (flag === 'parado' && !c.operadorParado) return false;
      if (nq && !normalizar(`${numeroChamado(c.id)} ${c.titulo} ${c.ocupante} ${c.layoutId ? baiaCodigo(st, c.layoutId, c.pos) : c.local} ${nomeUser(st, c.remetenteId)}`).includes(nq)) return false;
      return true;
    }).sort((a, b) => PRIORIDADES.indexOf(a.prioridade) - PRIORIDADES.indexOf(b.prioridade) || info(a).resta - info(b).resta);
  }, [abertos, q, prio, depto, flag, user.id, agora, st]); // eslint-disable-line react-hooks/exhaustive-deps

  const estourados = abertos.filter((c) => info(c).nivel === 'estourado' && !info(c).pausado).length;
  const quase = abertos.filter((c) => info(c).nivel === 'alerta' && !info(c).pausado).length;
  const setV = (v) => { setVis(v); localStorage.setItem('bencalls:painel', v); };

  return (
    <>
      <PageHead title="Painel de chamados" desc="Em andamento, por prioridade e prazo.">
        <Seg label="Visualização" value={vis} onChange={setV} options={[{ value: 'kanban', label: 'Quadro', icon: KanbanSquare }, { value: 'lista', label: 'Lista', icon: List }]} />
      </PageHead>
      <BannerIncidentes />
      <div className="grid-kpi">
        <Kpi icon={Flame} ajuda={<AjudaSla />} label="SLA estourado" valor={estourados} destaque={estourados > 0} ativo={flag === 'sla'} onClick={() => setFlag(flag === 'sla' ? 'todos' : 'sla')} />
        <Kpi icon={Timer} tom="aviso" label="SLA perto de estourar" valor={quase} title="Menos de 25% do prazo restante" ativo={flag === 'sla'} onClick={() => setFlag(flag === 'sla' ? 'todos' : 'sla')} />
        <Kpi icon={AlertTriangle} tom="aviso" label="Alertas de triagem" valor={abertos.filter((c) => c.alerta).length} title="Passos da triagem marcados rápido demais" ativo={flag === 'alerta'} onClick={() => setFlag(flag === 'alerta' ? 'todos' : 'alerta')} />
        <Kpi icon={ClipboardCheck} label="“Outros” a revisar" valor={abertos.filter((c) => c.outros && !c.outrosRevisado).length} tom="info" title="Chamados fora do catálogo aguardando revisão" ativo={flag === 'outros'} onClick={() => setFlag(flag === 'outros' ? 'todos' : 'outros')} />
        <Kpi icon={UserCheck} label="Comigo" valor={abertos.filter((c) => c.tecnicoId === user.id).length} tom="ok" title="Chamados que você assumiu" ativo={flag === 'meus'} onClick={() => setFlag(flag === 'meus' ? 'todos' : 'meus')} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="search-wrap min-w-[220px] flex-[1_1_260px]">
          <Search size={16} />
          <input className="input input-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar número, baia, pessoa…" aria-label="Buscar no painel" />
        </div>
        <select className="select w-auto" value={flag} onChange={(e) => setFlag(e.target.value)} aria-label="Mostrar">
          <option value="todos">Todos os chamados</option>
          <option value="meus">Só os meus</option>
          <option value="parado">Operador parado</option>
          <option value="sla">SLA em risco</option>
          <option value="alerta">Alerta de triagem</option>
          <option value="outros">“Outros” a revisar</option>
        </select>
        <select className="select w-auto" value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="Prioridade">
          <option value="Todas">Todas as prioridades</option>
          {PRIORIDADES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select className="select w-auto" value={depto} onChange={(e) => setDepto(e.target.value)} aria-label="Departamento">
          <option value="Todos">Todos os departamentos</option>
          <option>TI</option><option>Facilities</option>
        </select>
        {(q || prio !== 'Todas' || depto !== 'Todos' || flag !== 'todos') && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setPrio('Todas'); setDepto('Todos'); setFlag('todos'); }}>Limpar</button>
        )}
      </div>

      {filtrados.length === 0 && <Empty title="Nenhum chamado com esses filtros">Limpe os filtros para ver todos os {abertos.length} chamados em andamento.</Empty>}

      {vis === 'kanban' && filtrados.length > 0 && (
        <div className="kanban">
          {COLS.map((col) => {
            const cs = filtrados.filter((c) => c.status === col);
            return (
              <div key={col} className="k-col">
                <div className="k-col-head"><StatusBadge status={col} /><b className="text-xs">{cs.length}</b></div>
                {cs.map((c) => <TicketCard key={c.id} c={c} modo="kanban" onClick={() => abrir({ ch: c.id })} />)}
                {!cs.length && <span className="text-xs text-mudo text-center p-3">Vazio</span>}
              </div>
            );
          })}
        </div>
      )}

      {vis === 'lista' && filtrados.length > 0 && (
        <div className="card card-pad-0 table-wrap">
          <table className="table min-w-[900px]">
            <thead><tr><th>Chamado</th><th>Baia / local</th><th>Prioridade</th><th>Status</th><th><span className="flex flex-wrap items-center gap-1">SLA <AjudaSla /></span></th><th>Técnico</th><th>Aberto</th></tr></thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => abrir({ ch: c.id })} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && abrir({ ch: c.id })}>
                  <td><b>{numeroChamado(c.id)}</b><div className="text-xs">{c.titulo}</div>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {c.alerta && <span className="badge badge-sm b-bad">Alerta de triagem</span>}
                      {c.outros && !c.outrosRevisado && <span className="badge badge-sm b-outline">Outros</span>}
                      {c.operadorParado && <span className="badge badge-sm b-bad">Parado</span>}
                    </div></td>
                  <td><span className="tag">{c.layoutId ? baiaCodigo(st, c.layoutId, c.pos) : c.local || 'Sem baia'}</span><div className="text-[11px] text-mudo mt-1">{c.ocupante}</div></td>
                  <td><PrioBadge prio={c.prioridade} /></td>
                  <td><StatusBadge status={c.status} sm /></td>
                  <td className="min-w-[170px]"><Sla ch={c} agora={agora} bar /></td>
                  <td>{c.tecnicoId ? nomeUser(st, c.tecnicoId) : <span className="text-mudo">—</span>}</td>
                  <td className="text-xs text-mudo">{idade(c.criadoEm, agora)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
