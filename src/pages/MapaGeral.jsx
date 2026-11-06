import { useOutletContext } from 'react-router-dom';
import { useStore } from '../store/store.jsx';
import { statusBaia } from '../store/selectors.js';
import { posicoesDaMesa, posKey } from '../lib/labels.ts';
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
          <section key={sala} className="card flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2>{sala}</h2>
              <span className="text-xs text-mudo">{sala === 'Operacional' ? 'Vista de frente: equipes numeradas da direita para a esquerda' : `${mesas.length} mesa(s)`}</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,_minmax(230px,_1fr))] gap-3.5">
              {mesas.map((L) => (
                <div key={L.id} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-3"><b>{L.base}</b><span className="text-[11px] text-mudo">{L.nome}{user.perfil !== 'supervisor' && L.supervisorId ? ` · ${st.usuarios.find((u) => u.id === L.supervisorId)?.nome || ''}` : ''}</span></div>
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
