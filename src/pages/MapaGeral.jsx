import { useOutletContext } from 'react-router-dom';
import { useStore } from '../store/store.jsx';
import { statusBaia } from '../store/selectors.js';
import { posicoesDaMesa, posKey } from '../lib/labels.js';
import { PageHead, Kpi } from '../components/ui.jsx';
import DeskMap, { Legenda } from '../components/DeskMap.jsx';
import { BannerIncidentes } from './MeusChamados.jsx';
import { ST_BAIA } from '../components/BaiaDetail.jsx';

/** RF33: mapa geral de todas as equipes e mesas, com os chamados abertos marcados. */
export default function MapaGeral() {
  const { st, user } = useStore();
  const { abrir } = useOutletContext();
  const salas = [...new Set(st.layouts.map((l) => l.sala))];
  const cont = { ok: 0, aberto: 0, parado: 0, vazia: 0 };
  st.layouts.forEach((L) => posicoesDaMesa(L).forEach((p) => { cont[statusBaia(st, L.id, posKey(p))]++; }));
  const total = Object.values(cont).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHead title="Mapa geral" desc={`Todas as salas e mesas no layout físico. ${total} posições cadastradas. Clique numa baia para ver o histórico, os itens e os chamados.`}>
        <Legenda />
      </PageHead>
      <BannerIncidentes />
      <div className="grid-kpi">
        {Object.entries(cont).map(([k, v]) => <Kpi key={k} label={ST_BAIA[k].label} valor={v} sub={`${Math.round((v / total) * 100)}% das posições`} destaque={k === 'parado' && v > 0} />)}
      </div>
      {salas.map((sala) => {
        let mesas = st.layouts.filter((l) => l.sala === sala);
        // As equipes do operacional são numeradas da direita para a esquerda (§4.2).
        if (sala === 'Operacional') mesas = [...mesas].reverse();
        return (
          <section key={sala} className="card stack">
            <div className="row-between">
              <h2>{sala}</h2>
              <span className="small muted">{sala === 'Operacional' ? 'Vista de frente: equipes numeradas da direita para a esquerda' : `${mesas.length} mesa(s)`}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
              {mesas.map((L) => (
                <div key={L.id} className="stack-sm">
                  <div className="row-between"><b>{L.base}</b><span className="tiny muted">{L.nome}{user.perfil !== 'supervisor' && L.supervisorId ? ` · ${st.usuarios.find((u) => u.id === L.supervisorId)?.nome || ''}` : ''}</span></div>
                  <DeskMap layout={L} compact mostrarChamado onPick={(k) => abrir({ baia: `${L.id}:${k}` })} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
