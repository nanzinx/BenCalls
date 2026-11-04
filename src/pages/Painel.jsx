import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { KanbanSquare, List, Search, Flame, AlertTriangle, ClipboardCheck, UserCheck, Timer } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { baiaCodigo, nomeUser } from '../store/selectors.js';
import { ABERTOS, PRIORIDADES, slaInfo } from '../lib/rules.js';
import { normalizar, numeroChamado, idade } from '../lib/format.js';
import { PageHead, Seg, Pills, Empty, StatusBadge, PrioBadge, Sla, Kpi } from '../components/ui.jsx';
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
      <PageHead title="Painel de chamados" desc="Chamados em andamento, com baia, item e triagem. Ordenados por prioridade e pelo prazo de SLA restante.">
        <Seg label="Visualização" value={vis} onChange={setV} options={[{ value: 'kanban', label: 'Quadro', icon: KanbanSquare }, { value: 'lista', label: 'Lista', icon: List }]} />
      </PageHead>
      <BannerIncidentes />
      <div className="grid-kpi">
        <Kpi icon={Flame} label="SLA estourado" valor={estourados} sub="Relógio do SLA correndo" destaque={estourados > 0} onClick={() => setFlag('sla')} />
        <Kpi icon={Timer} label="SLA perto de estourar" valor={quase} sub="Menos de 25% do prazo" onClick={() => setFlag('sla')} />
        <Kpi icon={AlertTriangle} label="Alertas de triagem" valor={abertos.filter((c) => c.alerta).length} sub="Passos marcados rápido demais" onClick={() => setFlag('alerta')} />
        <Kpi icon={ClipboardCheck} label="“Outros” a revisar" valor={abertos.filter((c) => c.outros && !c.outrosRevisado).length} sub="Fila de revisão" onClick={() => setFlag('outros')} />
        <Kpi icon={UserCheck} label="Comigo" valor={abertos.filter((c) => c.tecnicoId === user.id).length} sub="Chamados que você assumiu" onClick={() => setFlag('meus')} />
      </div>

      <div className="card stack" style={{ padding: 14 }}>
        <div className="row-between">
          <div className="search-wrap" style={{ flex: '1 1 260px', maxWidth: 380 }}>
            <Search size={16} />
            <input className="input input-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, baia, ocupante, solicitante…" aria-label="Buscar no painel" />
          </div>
          <Pills label="Departamento" value={depto} onChange={setDepto} options={['Todos', 'TI', 'Facilities']} />
        </div>
        <div className="row-between">
          <Pills label="Prioridade" value={prio} onChange={setPrio} options={['Todas', ...PRIORIDADES]} />
          <Pills label="Filtro rápido" value={flag} onChange={setFlag} options={[
            { value: 'todos', label: 'Todos' }, { value: 'meus', label: 'Comigo' }, { value: 'parado', label: 'Operador parado' },
            { value: 'sla', label: 'SLA em risco' }, { value: 'alerta', label: 'Alerta de triagem' }, { value: 'outros', label: '“Outros”' }
          ]} />
        </div>
      </div>

      {filtrados.length === 0 && <Empty title="Nenhum chamado com esses filtros">Limpe os filtros para ver todos os {abertos.length} chamados em andamento.</Empty>}

      {vis === 'kanban' && filtrados.length > 0 && (
        <div className="kanban">
          {COLS.map((col) => {
            const cs = filtrados.filter((c) => c.status === col);
            return (
              <div key={col} className="k-col">
                <div className="k-col-head"><StatusBadge status={col} /><b className="small">{cs.length}</b></div>
                {cs.map((c) => <TicketCard key={c.id} c={c} modo="kanban" onClick={() => abrir({ ch: c.id })} />)}
                {!cs.length && <span className="small muted" style={{ textAlign: 'center', padding: 12 }}>Vazio</span>}
              </div>
            );
          })}
        </div>
      )}

      {vis === 'lista' && filtrados.length > 0 && (
        <div className="card card-pad-0 table-wrap">
          <table className="table" style={{ minWidth: 900 }}>
            <thead><tr><th>Chamado</th><th>Baia / local</th><th>Prioridade</th><th>Status</th><th>SLA</th><th>Técnico</th><th>Aberto</th></tr></thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => abrir({ ch: c.id })} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && abrir({ ch: c.id })}>
                  <td><b>{numeroChamado(c.id)}</b><div className="small">{c.titulo}</div>
                    <div className="row" style={{ gap: 4, marginTop: 4 }}>
                      {c.alerta && <span className="badge badge-sm b-bad">Alerta de triagem</span>}
                      {c.outros && !c.outrosRevisado && <span className="badge badge-sm b-outline">Outros</span>}
                      {c.operadorParado && <span className="badge badge-sm b-bad">Parado</span>}
                    </div></td>
                  <td><span className="tag">{c.layoutId ? baiaCodigo(st, c.layoutId, c.pos) : c.local || 'Sem baia'}</span><div className="tiny muted" style={{ marginTop: 4 }}>{c.ocupante}</div></td>
                  <td><PrioBadge prio={c.prioridade} /></td>
                  <td><StatusBadge status={c.status} sm /></td>
                  <td style={{ minWidth: 170 }}><Sla ch={c} agora={agora} bar /></td>
                  <td>{c.tecnicoId ? nomeUser(st, c.tecnicoId) : <span className="muted">—</span>}</td>
                  <td className="small muted">{idade(c.criadoEm, agora)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
