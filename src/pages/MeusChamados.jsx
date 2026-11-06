import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { PlusCircle, Search, Activity, MessageCircleQuestion, CheckCircle2, Sparkles, Siren } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { chamadosVisiveis, layoutsDoUsuario, tem, statusBaia, indiceCatalogo, baiaCodigo } from '../store/selectors.js';
import { ABERTOS, FINAIS, detectarIncidentes } from '../lib/rules.ts';
import { posicoesDaMesa, posKey } from '../lib/labels.ts';
import { normalizar, numeroChamado, DIA } from '../lib/format.ts';
import { Kpi, PageHead, Empty, Pills, Note } from '../components/ui.jsx';
import TicketCard from '../components/TicketCard.jsx';
import { ST_BAIA } from '../components/BaiaDetail.jsx';

export function BannerIncidentes() {
  const { st, agora } = useStore();
  const { sits } = useMemo(() => indiceCatalogo(st), [st]);
  const inc = detectarIncidentes(st.chamados, { agora });
  if (!inc.length) return null;
  return inc.map((i) => (
    <Note key={i.sitId} tipo="bad" icon={Siren}>
      <b>Problema conhecido (incidente geral):</b> {i.chamados.length} chamados de “{sits[i.sitId]?.sub.nome} — {sits[i.sitId]?.nome}” na última hora
      ({i.chamados.map((c) => c.layoutId ? baiaCodigo(st, c.layoutId, c.pos) : numeroChamado(c.id)).join(', ')}). O TI já foi avisado; evite abrir chamados repetidos.
    </Note>
  ));
}

export default function MeusChamados() {
  const { st, user, agora } = useStore();
  const { abrir } = useOutletContext();
  const nav = useNavigate();
  const [filtro, setFiltro] = useState('abertos');
  const [q, setQ] = useState('');

  const meus = useMemo(() => chamadosVisiveis(st, user).filter((c) => c.remetenteId === user.id || user.perfil === 'supervisor'), [st, user]);
  const conta = (f) => meus.filter(f).length;
  const inicioMes = new Date(agora); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const aguard = conta((c) => c.status === 'Aguardando Consenso' && c.remetenteId === user.id);
  const triagemMes = st.triagensResolvidas.filter((t) => t.at >= agora - 30 * DIA && (user.perfil !== 'supervisor' || (user.equipes || []).includes(t.layoutId))).length;

  const lista = useMemo(() => {
    const nq = normalizar(q);
    return meus.filter((c) => {
      if (filtro === 'abertos' && !ABERTOS.includes(c.status)) return false;
      if (filtro === 'confirmar' && !(c.status === 'Aguardando Consenso' && c.remetenteId === user.id)) return false;
      if (filtro === 'encerrados' && !FINAIS.includes(c.status)) return false;
      if (nq && !normalizar(`${numeroChamado(c.id)} ${c.titulo} ${c.ocupante} ${c.layoutId ? baiaCodigo(st, c.layoutId, c.pos) : c.local}`).includes(nq)) return false;
      return true;
    }).sort((a, b) => {
      const pa = a.status === 'Aguardando Consenso' ? 0 : FINAIS.includes(a.status) ? 2 : 1;
      const pb = b.status === 'Aguardando Consenso' ? 0 : FINAIS.includes(b.status) ? 2 : 1;
      return pa - pb || b.criadoEm - a.criadoEm;
    });
  }, [meus, filtro, q, st, user.id]);

  const mesas = layoutsDoUsuario(st, user);
  const resumo = user.perfil === 'supervisor' ? mesas.map((L) => {
    const cont = { ok: 0, aberto: 0, parado: 0, vazia: 0 };
    posicoesDaMesa(L).forEach((p) => { cont[statusBaia(st, L.id, posKey(p))]++; });
    return { L, cont };
  }) : [];

  return (
    <>
      <PageHead title={`Olá, ${user.nome.split(' ')[0]}`} desc={user.perfil === 'supervisor' ? `Sua equipe · ${mesas.map((m) => m.base).join(', ')}` : 'Chamados abertos por você'}>
        {tem(user, 'RC') && <button type="button" className="btn btn-primary btn-lg" onClick={() => nav('/novo')}><PlusCircle size={17} /> Novo chamado</button>}
      </PageHead>

      <BannerIncidentes />

      <div className="grid-kpi">
        <Kpi icon={Activity} label="Em andamento" valor={conta((c) => ['Em Análise', 'Pendente', 'Em Execução'].includes(c.status))} title="Em análise, pendentes ou em execução" onClick={() => setFiltro('abertos')} />
        <Kpi icon={MessageCircleQuestion} label="Para confirmar" valor={aguard} title="O TI já registrou a solução: confirme se resolveu" tom="aviso" onClick={() => setFiltro('confirmar')} />
        <Kpi icon={CheckCircle2} tom="ok" label="Concluídos no mês" valor={conta((c) => c.status === 'Concluído' && c.criadoEm >= inicioMes.getTime())} sub={`${conta((c) => c.status === 'Concluído')} no total`} onClick={() => setFiltro('encerrados')} />
        {user.perfil === 'supervisor' && <Kpi icon={Sparkles} tom="info" label="Resolvidos na triagem" valor={triagemMes} title="Problemas resolvidos sem abrir chamado nos últimos 30 dias" />}
      </div>

      <div className="split">
        <section className="main flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Pills label="Filtrar chamados" value={filtro} onChange={setFiltro} options={[
              { value: 'abertos', label: 'Em aberto', count: conta((c) => ABERTOS.includes(c.status)) },
              { value: 'confirmar', label: 'Confirmar solução', count: aguard },
              { value: 'encerrados', label: 'Encerrados', count: conta((c) => FINAIS.includes(c.status)) },
              { value: 'todos', label: 'Todos', count: meus.length }
            ]} />
            <div className="search-wrap min-w-[240px] flex-[0_1_300px]">
              <Search size={16} />
              <input className="input input-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número, baia, título ou ocupante" aria-label="Buscar nos meus chamados" />
            </div>
          </div>
          {lista.length === 0 && <Empty title={filtro === 'confirmar' ? 'Nada para confirmar' : 'Nenhum chamado aqui'}>{filtro === 'abertos' ? 'Sua equipe está sem chamados em aberto. 🎉' : 'Tente outro filtro ou busca.'}</Empty>}
          <div className="flex flex-col gap-2.5">
            {lista.slice(0, 60).map((c) => <TicketCard key={c.id} c={c} onClick={() => abrir({ ch: c.id })} />)}
          </div>
          {lista.length > 60 && <span className="text-xs text-mudo">Mostrando os 60 mais recentes de {lista.length}. Use a busca para encontrar os outros.</span>}
        </section>

        {resumo.length > 0 && (
          <aside className="side flex flex-col gap-3">
            {resumo.map(({ L, cont }) => (
              <div key={L.id} className="card flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-3"><b>{L.base} · {L.nome}</b><button type="button" className="btn btn-sm" onClick={() => nav(`/novo?mesa=${L.id}`)}>Abrir mapa</button></div>
                <div className="flex flex-wrap items-center gap-3.5">
                  {Object.entries(cont).map(([k, v]) => <span key={k} className="flex flex-wrap items-center text-xs gap-1.5"><span className="dot" style={{ background: ST_BAIA[k].dot }} />{v} {ST_BAIA[k].label.toLowerCase()}</span>)}
                </div>
              </div>
            ))}
          </aside>
        )}
      </div>
    </>
  );
}
