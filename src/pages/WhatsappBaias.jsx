// WhatsApp das Baias dentro do BenCalls: as mesmas regras e o mesmo mapa (.json versão 3) do
// BenHermes, ligados às baias, aos ocupantes e aos chamados daqui.
import { useEffect, useMemo, useRef, useState } from 'react';
import { statusDaIntegracao } from '../components/IntegracaoBenHermes.jsx';
import { numeroChamado } from '../lib/format.ts';
import { VERSAO_BENHERMES } from '../lib/benhermes/versao.ts';
import clsx from 'clsx';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import {
  Map as MapIcon, Wrench, Smartphone, History, PlugZap, Copy, Check, Download, Upload, AlertTriangle, Users,
  CheckCircle2, Circle, Play, X, RefreshCw
} from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { tem, layoutsDoUsuario, nomeUser } from '../store/selectors.js';
import { PageHead, Seg, Kpi, Empty, Note, Modal } from '../components/ui.jsx';
import DeskMap, { Legenda } from '../components/DeskMap.jsx';
import { SituacaoChip, BotoesAcao, TOM_CHIP } from '../components/WhatsappUi.jsx';
import { alertasUrgentes, divergencias, usarOcupantesDoBenCalls, mapaDasMesas, acharMesa, TEXTO_ALERTA, TEXTO_SITUACAO } from '../lib/whatsapp-baias.ts';
import { alertas as todosOsAlertas, resumoGeral } from '../lib/benhermes/whatsappAlertas.ts';
import {
  etapasDaManutencao, numerosDaEtapa, iniciarManutencao, alternarConferido, concluirManutencao, cancelarManutencao,
  trocarJanela, textoDaManutencao, ROTULO_JANELA, GRUPO_SEM_CELULAR
} from '../lib/benhermes/whatsappManutencao.ts';
import { exportarMapa, importarMapa, filtrarMapaParaSupervisor, tempoDesde, adicionarMesaNoMapa } from '../lib/benhermes/whatsappBaias.ts';
import { estadoDaVaga, nomeDaVaga, nomeDoCelular } from '../lib/benhermes/celulares.ts';

const ABAS = [
  { value: 'mapa', label: 'Mapa', icon: MapIcon },
  { value: 'manutencao', label: 'Manutenção', icon: Wrench },
  { value: 'celulares', label: 'Celulares', icon: Smartphone },
  { value: 'historico', label: 'Histórico', icon: History },
  { value: 'integracao', label: 'BenHermes', icon: PlugZap }
];

const dataHora = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function Copiar({ texto, rotulo = 'Copiar texto' }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className={clsx('btn', ok ? 'btn-ok' : 'btn-primary')}
      onClick={async () => { try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1800); } catch { /* sem permissão */ } }}>
      {ok ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> {rotulo}</>}
    </button>
  );
}

export default function WhatsappBaias() {
  const { st, user, agora } = useStore();
  const { abrir } = useOutletContext();
  const [sp, setSp] = useSearchParams();
  const gestao = tem(user, 'ASC') || user.perfil === 'gestor';
  const abas = gestao ? ABAS : ABAS.filter((a) => ['mapa', 'celulares', 'historico'].includes(a.value));
  const aba = abas.some((a) => a.value === sp.get('aba')) ? sp.get('aba') : 'mapa';
  const setAba = (v) => { const n = new URLSearchParams(sp); if (v === 'mapa') n.delete('aba'); else n.set('aba', v); setSp(n, { replace: true }); };
  const d = useMemo(() => new Date(agora), [agora]);

  // Supervisor vê só a própria equipe (mesma regra do BenHermes).
  const mapa = useMemo(() => {
    if (!st.whatsapp) return null;
    return user.perfil === 'supervisor' ? filtrarMapaParaSupervisor(st.whatsapp, { id: user.id, displayName: user.nome, username: user.user }) : st.whatsapp;
  }, [st.whatsapp, user]);

  if (!mapa) return <Empty title="Sem mapa do WhatsApp">Importe o mapa do BenHermes na aba BenHermes.</Empty>;
  const r = resumoGeral(mapa, d);
  const urgentes = alertasUrgentes(mapa, d);

  return (
    <>
      <PageHead title="WhatsApp das Baias" badge="BenHermes"
        desc={user.perfil === 'supervisor' ? 'O WhatsApp de cada baia da sua equipe. Clique numa baia para atualizar.' : 'Situação do WhatsApp de cada baia, os celulares e a manutenção, com as mesmas regras do BenHermes.'}>
        <Seg label="Seções" value={aba} onChange={setAba} options={abas} />
      </PageHead>

      {mapa.manutencaoAtual && aba !== 'manutencao' && gestao && (
        <Note tipo="warn" icon={<Wrench size={16} />}>
          Manutenção {ROTULO_JANELA[mapa.manutencaoAtual.janela].toLowerCase()} aberta desde {dataHora(mapa.manutencaoAtual.inicio)}.{' '}
          <button type="button" className="font-semibold underline" onClick={() => setAba('manutencao')}>Continuar de onde parou</button>
        </Note>
      )}

      {aba === 'mapa' && <AbaMapa mapa={mapa} r={r} urgentes={urgentes} d={d} abrir={abrir} />}
      {aba === 'manutencao' && gestao && <AbaManutencao d={d} />}
      {aba === 'celulares' && <AbaCelulares mapa={mapa} d={d} />}
      {aba === 'historico' && <AbaHistorico mapa={mapa} />}
      {aba === 'integracao' && gestao && <AbaIntegracao d={d} />}
    </>
  );
}

// ------------------------------------------------------------------ Mapa
function AbaMapa({ mapa, r, urgentes, d, abrir }) {
  const { st, user } = useStore();
  const [verTodos, setVerTodos] = useState(false);
  const lista = verTodos ? todosOsAlertas(mapa, d) : urgentes;
  const layouts = layoutsDoUsuario(st, user);
  const salas = [...new Set(layouts.map((l) => l.sala))];
  const abrirAlerta = (a) => {
    if (a.alvo.tipo !== 'lugar') return;
    const mesa = mapa.salas.flatMap((s) => s.mesas).find((m) => m.id === a.alvo.mesaId);
    const L = mesa && st.layouts.find((l) => l.base.toUpperCase() === mesa.sigla.toUpperCase());
    if (L) abrir({ baia: `${L.id}:${a.alvo.posicao}` });
  };

  return (
    <>
      <div className="grid-kpi">
        <Kpi label="OK" valor={r.ok} tom="ok" sub={`${r.celulares} ${r.celulares === 1 ? "celular" : "celulares"}`} />
        <Kpi label="Banidos" valor={r.banido} tom="ruim" destaque={r.banido > 0} sub="pedir a análise" />
        <Kpi label="Em análise" valor={r.analise} tom="aviso" sub={r.analiseAtrasada ? `${r.analiseAtrasada} com mais de 24 h` : 'dentro das 24 h'} />
        <Kpi label="Restringidos" valor={r.restringido} tom="aviso" sub={r.vencidas ? `${r.vencidas} já terminou` : 'no prazo'} />
        <Kpi label="Perdidos" valor={r.permanente} tom="marca" sub="trocar o chip" />
      </div>

      <section className="card flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2"><AlertTriangle size={17} className={urgentes.length ? 'text-ruim' : 'text-mudo'} /> Atenção <span className="text-sm font-normal text-mudo">· do mais urgente ao menos</span></h2>
          <label className="check text-xs"><input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} /> Mostrar restringidos e sem WhatsApp</label>
        </div>
        {!lista.length && <p className="text-sm text-mudo">Nada precisa de ação agora. 🎉</p>}
        <div className="flex flex-col divide-y divide-linha">
          {lista.slice(0, 12).map((a, i) => (
            <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <button type="button" className="flex min-w-[220px] flex-1 flex-col text-left disabled:cursor-default" disabled={a.alvo.tipo !== 'lugar'} onClick={() => abrirAlerta(a)}>
                <span className="flex flex-wrap items-center gap-2">
                  <b className="font-mono text-marca-txt">{a.onde}</b>
                  <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-semibold', TOM_CHIP[a.tipo === 'RESTRINGIDO' || a.tipo === 'NAO_TEM' ? 'cinza' : a.tipo === 'PERMANENTE' ? 'escuro' : 'ruim'])}>{TEXTO_ALERTA[a.tipo]}</span>
                </span>
                <span className="text-xs text-mudo">{a.quem} · {a.tipo === 'RESTRICAO_VENCIDA' ? `terminou ${dataHora(a.ate)}` : a.ate ? `até ${dataHora(a.ate)}` : `há ${tempoDesde(a.desde, d)}`}</span>
              </button>
              <BotoesAcao alvo={a.alvo} estado={estadoDoAlerta(mapa, a)} agora={d} />
            </div>
          ))}
        </div>
        {lista.length > 12 && <span className="text-xs text-mudo">E mais {lista.length - 12}.</span>}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-mudo">O mapa é o mesmo do BenCalls: clique numa baia para ver o WhatsApp, os chamados e os itens dela.</span>
        <Legenda camada="whatsapp" />
      </div>
      {salas.map((sala) => {
        let mesas = layouts.filter((l) => l.sala === sala);
        if (sala === 'Operacional') mesas = [...mesas].reverse();
        return (
          <section key={sala} className="card flex flex-col gap-3">
            <h2>{sala}</h2>
            <div className="grid grid-cols-[repeat(auto-fill,_minmax(230px,_1fr))] gap-3.5">
              {mesas.map((L) => {
                const mesa = acharMesa(mapa, L.base)?.mesa;
                return (
                  <div key={L.id} className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <b>{L.base}</b>
                      <span className="text-[11px] text-mudo">{mesa ? `Supervisor: ${mesa.whatsappSupervisor === 'NAO_TEM' ? 'sem WhatsApp' : mesa.whatsappSupervisor === 'PC' ? 'no PC' : 'no celular'}` : 'fora do mapa do WhatsApp'}</span>
                    </div>
                    <DeskMap layout={L} compact camada="whatsapp" onPick={(k) => abrir({ baia: `${L.id}:${k}` })} />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}

function estadoDoAlerta(mapa, a) {
  if (a.alvo.tipo === 'lugar') {
    const mesa = mapa.salas.flatMap((s) => s.mesas).find((m) => m.id === a.alvo.mesaId);
    return mesa.lugares[a.alvo.posicao].whatsapp;
  }
  const c = mapa.celulares.find((x) => x.id === a.alvo.celularId);
  return estadoDaVaga(mapa, c, c.vagas.find((v) => v.id === a.alvo.vagaId));
}

// ------------------------------------------------------------------ Manutenção
function AbaManutencao({ d }) {
  const { st, actions, toast } = useStore();
  const mapa = st.whatsapp;
  const m = mapa.manutencaoAtual;
  const etapas = useMemo(() => etapasDaManutencao(mapa), [mapa]);
  const [etapaId, setEtapaId] = useState(null);
  const [obs, setObs] = useState('');
  const [texto, setTexto] = useState(null);
  const [anterior, setAnterior] = useState(null);

  if (!m) {
    const ultimas = [...mapa.manutencoes].reverse().slice(0, 8);
    return (
      <>
        <section className="card flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2>Manutenção do WhatsApp</h2>
            <p className="text-sm text-mudo">Manhã (8:00–11:59) e almoço da operação (12:00–14:59): celular por celular, os botões do que aconteceu e, no fim, o texto para o grupo.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => { actions.whatsappMudar((mm, dd) => iniciarManutencao(mm, dd), { acao: 'WhatsApp: manutenção iniciada' }); setTexto(null); }}>
            <Play size={16} /> Iniciar manutenção
          </button>
        </section>
        {texto && (
          <section className="card flex flex-col gap-3 border-ok-ponto">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2>Pronto: mande no grupo antes dos vídeos</h2><Copiar texto={texto} /></div>
            <pre className="whitespace-pre-wrap rounded-xl bg-superficie-2 p-4 font-sans text-sm leading-relaxed">{texto}</pre>
          </section>
        )}
        <section className="card flex flex-col gap-2">
          <h2>Manutenções anteriores</h2>
          {!ultimas.length && <p className="text-sm text-mudo">Nenhuma ainda.</p>}
          {ultimas.map((x) => (
            <button key={x.id} type="button" className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-superficie-2" onClick={() => setAnterior(x)}>
              <span><b>{dataHora(x.inicio).slice(0, 5)}</b> · {ROTULO_JANELA[x.janela]} ({dataHora(x.inicio).slice(6)}–{dataHora(x.fim).slice(6)})</span>
              <span className="text-xs text-mudo">{x.acoes.length} {x.acoes.length === 1 ? 'ação' : 'ações'} · {x.conferidos.length} conferidos{x.observacao ? ' · com observação' : ''}</span>
            </button>
          ))}
        </section>
        {anterior && (
          <Modal title={`Manutenção de ${dataHora(anterior.inicio).slice(0, 5)} · ${ROTULO_JANELA[anterior.janela]}`} onClose={() => setAnterior(null)} footer={<Copiar texto={anterior.texto} />}>
            <pre className="whitespace-pre-wrap rounded-xl bg-superficie-2 p-4 font-sans text-sm leading-relaxed">{anterior.texto}</pre>
          </Modal>
        )}
      </>
    );
  }

  const atual = etapas.find((e) => e.id === etapaId) || etapas.find((e) => !m.conferidos.includes(e.id)) || etapas[0];
  const numeros = atual ? numerosDaEtapa(mapa, atual.id) : [];
  const conferidos = etapas.filter((e) => m.conferidos.includes(e.id)).length;
  const conferir = () => {
    actions.whatsappMudar((mm) => alternarConferido(mm, atual.id));
    const prox = etapas.find((e) => e.id !== atual.id && !m.conferidos.includes(e.id));
    setEtapaId(prox?.id || null);
  };

  return (
    <>
      <section className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="flex items-center gap-2"><Wrench size={18} /> Manutenção em andamento</h2>
            <span className="text-sm text-mudo">Desde {dataHora(m.inicio).slice(6)} · {conferidos} de {etapas.length} conferidos · {m.acoes.length} {m.acoes.length === 1 ? 'ação' : 'ações'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="select w-auto" value={m.janela} aria-label="Janela da manutenção" onChange={(e) => actions.whatsappMudar((mm) => trocarJanela(mm, e.target.value))}>
              {Object.entries(ROTULO_JANELA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button type="button" className="btn btn-ghost text-ruim" onClick={() => { if (confirm('Cancelar a manutenção? Só o registro é descartado: as mudanças de situação feitas continuam.')) actions.whatsappMudar((mm) => cancelarManutencao(mm), { acao: 'WhatsApp: manutenção cancelada' }); }}>
              <X size={15} /> Cancelar
            </button>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-superficie-3" aria-hidden="true">
          <div className="h-full rounded-full bg-ok-ponto transition-all duration-500" style={{ width: `${etapas.length ? (conferidos / etapas.length) * 100 : 0}%` }} />
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Celulares">
          {etapas.map((e) => {
            const ok = m.conferidos.includes(e.id);
            return (
              <button key={e.id} type="button" role="tab" aria-selected={atual?.id === e.id} onClick={() => setEtapaId(e.id)}
                className={clsx('pill gap-1.5', atual?.id === e.id && 'ring-2 ring-marca')}>
                {e.hex ? <span className="h-3 w-3 rounded-full border border-linha-forte" style={{ background: e.hex }} aria-hidden="true" /> : <Users size={13} />}
                {e.titulo}{e.equipe && <span className="text-mudo">({e.equipe})</span>}
                {ok ? <CheckCircle2 size={14} className="text-ok" aria-label="conferido" /> : <Circle size={14} className="text-mudo" aria-label="a conferir" />}
              </button>
            );
          })}
        </div>
      </section>

      {atual && (
        <section className="card flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <h2>{atual.id === GRUPO_SEM_CELULAR ? 'Baias sem celular e supervisores' : `📱 ${atual.titulo}${atual.equipe ? ` · ${atual.equipe}` : ''}`}</h2>
            <button type="button" className={clsx('btn', m.conferidos.includes(atual.id) ? 'btn-ghost' : 'btn-ok')} onClick={conferir}>
              {m.conferidos.includes(atual.id) ? 'Desmarcar conferido' : <><CheckCircle2 size={16} /> Celular conferido</>}
            </button>
          </div>
          <div className="flex flex-col divide-y divide-linha">
            {numeros.map((n) => (
              <div key={n.chave} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                <span className="flex min-w-[220px] flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="font-mono text-marca-txt">{n.retrato?.codigo || n.retrato?.vaga || '—'}</b>
                    <SituacaoChip estado={n.estado} agora={d} sm />
                  </span>
                  <span className="text-xs text-mudo">{n.retrato?.operador || 'Vaga vazia'}{n.retrato?.vaga && n.retrato?.codigo ? ` · ${n.retrato.vaga}` : ''}</span>
                </span>
                <BotoesAcao alvo={n.alvo} estado={n.estado} agora={d} />
              </div>
            ))}
            {!numeros.length && <p className="py-2 text-sm text-mudo">Nenhum WhatsApp neste grupo.</p>}
          </div>
        </section>
      )}

      <section className="card flex flex-col gap-3">
        <h2>Concluir</h2>
        <label className="field">Observação (opcional)
          <textarea className="textarea" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: celular Verde com a bateria fraca" />
        </label>
        <details className="text-sm">
          <summary className="cursor-pointer text-mudo">Ver como o texto vai ficar</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-superficie-2 p-4 font-sans text-sm leading-relaxed">{textoDaManutencao({ ...m, observacao: obs }, mapa, d)}</pre>
        </details>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary" onClick={() => {
            const r = actions.whatsappMudar((mm, dd) => concluirManutencao(mm, obs, dd), { acao: 'WhatsApp: manutenção concluída', detalhe: `${m.acoes.length} ações` });
            setObs(''); setEtapaId(null);
            setTexto(r.texto); // aparece logo em seguida (e fica em "Manutenções anteriores")
            toast('Manutenção concluída. Copie o texto e mande no grupo.');
          }}>
            <CheckCircle2 size={16} /> Concluir e gerar o texto
          </button>
          {conferidos < etapas.length && <span className="text-xs text-mudo">Faltam {etapas.length - conferidos} para conferir (dá para concluir assim mesmo).</span>}
        </div>
      </section>
    </>
  );
}

// ------------------------------------------------------------------ Celulares
function AbaCelulares({ mapa, d }) {
  const mesas = new Map(mapa.salas.flatMap((s) => s.mesas).map((m) => [m.id, m]));
  if (!mapa.celulares.length) return <Empty icon={Smartphone} title="Nenhum celular">Os celulares corporativos são cadastrados no BenHermes e vêm junto no mapa.</Empty>;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,_minmax(320px,_1fr))] gap-3">
      {mapa.celulares.map((c) => {
        const mesa = c.mesaId ? mesas.get(c.mesaId) : null;
        const problemas = c.vagas.filter((v) => estadoDaVaga(mapa, c, v).situacao !== 'OK').length;
        return (
          <section key={c.id} className="card flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <span className="h-9 w-9 flex-none rounded-xl border-2 border-linha-forte shadow-inner" style={{ background: c.hex }} aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-col">
                <b>{nomeDoCelular(c)}</b>
                <span className="text-xs text-mudo">{c.marca[0] + c.marca.slice(1).toLowerCase()} · {mesa ? `${mesa.sigla} · ${mesa.nome}` : 'guardado'}{c.compartilhado ? ' · compartilhado' : ''}</span>
              </div>
              <span className={clsx('badge badge-sm', problemas ? 'b-warn' : 'b-ok')}>{problemas ? `${problemas} com problema` : 'tudo OK'}</span>
            </div>
            <div className="flex flex-col divide-y divide-linha text-sm">
              {c.vagas.map((v) => {
                const e = estadoDaVaga(mapa, c, v);
                return (
                  <div key={v.id} className="flex items-center gap-2 py-1.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate"><b className="font-mono text-xs text-marca-txt">{v.baia && mesa ? `${mesa.sigla}-${v.baia}` : 'backup'}</b> · {nomeDaVaga(mapa, c, v)}</span>
                      <span className="block truncate text-[11px] text-mudo">{v.grupo} · {v.rotulo}{v.numero ? ` · ${v.numero}` : ''}</span>
                    </span>
                    <SituacaoChip estado={e} agora={d} sm />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ Histórico
const TEXTO_EVENTO = { SITUACAO: 'Situação', OPERADOR: 'Operador', ENTROU: 'Entrou', SAIU: 'Saiu' };
function AbaHistorico({ mapa }) {
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('todos');
  const eventos = useMemo(() => {
    const nq = q.trim().toUpperCase();
    return [...mapa.historico].reverse().filter((e) => (tipo === 'todos' || e.tipo === tipo) && (!nq || `${e.codigo} ${e.operador} ${e.celular} ${e.vaga} ${e.equipe}`.toUpperCase().includes(nq)));
  }, [mapa.historico, q, tipo]);
  const fmt = (t, v) => (t === 'SITUACAO' && TEXTO_SITUACAO[v]) || v || '—';
  return (
    <section className="card card-pad-0 flex flex-col">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <input className="input max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Baia, operador, celular…" aria-label="Filtrar histórico" />
        <select className="select w-auto" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de mudança">
          <option value="todos">Todas as mudanças</option>
          {Object.entries(TEXTO_EVENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="ml-auto text-xs text-mudo">Desde {dataHora(mapa.inicioDoHistorico).slice(0, 5)} · guarda 12 meses</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Quando</th><th>Baia</th><th>Mudança</th><th>Operador</th><th>Celular</th></tr></thead>
          <tbody>
            {eventos.slice(0, 150).map((e, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap">{dataHora(e.em)}{e.manutencaoId && <span className="ml-1.5 text-[11px] text-mudo" title="Na manutenção">🔧</span>}</td>
                <td className="font-mono">{e.codigo || <span className="text-mudo">backup</span>}</td>
                <td>{TEXTO_EVENTO[e.tipo]}: {fmt(e.tipo, e.de)} → <b>{fmt(e.tipo, e.para)}</b></td>
                <td>{e.operador || '—'}</td>
                <td className="text-mudo">{e.celular ? `${e.celular}${e.vaga ? ` · ${e.vaga}` : ''}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!eventos.length && <p className="p-4 text-sm text-mudo">Nenhuma mudança com esse filtro.</p>}
    </section>
  );
}

// ------------------------------------------------------------------ Integração com o BenHermes
function AbaIntegracao({ d }) {
  const { st, actions, toast } = useStore();
  const mapa = st.whatsapp;
  const difs = useMemo(() => divergencias(mapa, st.layouts, st.ocupacao), [mapa, st.layouts, st.ocupacao]);
  const [previa, setPrevia] = useState(null);
  const arquivo = useRef(null);
  const ops = difs.filter((x) => x.tipo === 'operador');
  const faltando = difs.filter((x) => x.tipo === 'mesa-sem-whatsapp');

  const baixar = () => {
    const blob = new Blob([exportarMapa(mapa, d)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const p = (n) => String(n).padStart(2, '0');
    a.download = `whatsapp-baias-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const ler = async (f) => {
    try {
      const novo = importarMapa(await f.text(), d);
      setPrevia({ mapa: novo, nome: f.name });
    } catch (e) { toast(`Não deu para ler o arquivo: ${e.message}`, 'bad'); }
    if (arquivo.current) arquivo.current.value = '';
  };
  const adicionarFaltando = () => {
    actions.whatsappMudar((mm, dd) => {
      const novas = mapaDasMesas(st.layouts.filter((l) => faltando.some((f) => f.layoutId === l.id)), st.ocupacao, (id) => nomeUser(st, id), dd);
      let out = mm;
      for (const sala of novas.salas) {
        const existente = out.salas.find((s) => s.nome === sala.nome);
        if (existente) for (const mesa of sala.mesas) out = adicionarMesaNoMapa(out, existente.id, mesa, dd);
        else out = { ...out, salas: [...out.salas, sala] };
      }
      return out;
    }, { acao: 'WhatsApp: mesas adicionadas', detalhe: faltando.map((f) => f.codigo).join(', ') });
    toast(`${faltando.length} mesa(s) adicionada(s) ao mapa do WhatsApp.`);
  };

  return (
    <>
      <section className="card flex flex-col gap-3">
        <h2 className="flex items-center gap-2"><PlugZap size={18} /> Mesmo mapa nos dois sistemas</h2>
        <p className="text-sm text-tinta-2">
          As regras do WhatsApp das Baias são as do BenHermes (commit <span className="font-mono">{VERSAO_BENHERMES}</span>), e o arquivo é o mesmo:
          o <b>.json</b> exportado aqui abre no BenHermes em <i>Importar mapa</i>, e o de lá abre aqui. Situações, celulares, histórico e manutenções vão juntos.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={baixar}><Download size={16} /> Exportar mapa (.json)</button>
          <button type="button" className="btn" onClick={() => arquivo.current?.click()}><Upload size={16} /> Importar mapa do BenHermes</button>
          <input ref={arquivo} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && ler(e.target.files[0])} />
        </div>
        <p className="text-xs text-mudo">Atualizado em {dataHora(mapa.atualizadoEm)} · {mapa.salas.reduce((n, s) => n + s.mesas.length, 0)} mesas · {mapa.celulares.length} celulares · {mapa.historico.length} mudanças no histórico · {mapa.manutencoes.length} manutenções.</p>
      </section>

      <section className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2>O que não bate com as baias do BenCalls</h2>
          <span className={clsx('badge', difs.length ? 'b-warn' : 'b-ok')}>{difs.length ? `${difs.length} diferença(s)` : 'tudo igual'}</span>
        </div>
        <p className="text-sm text-mudo">O BenCalls sabe quem senta em cada baia (troca de ocupante). Trocas feitas aqui já passam para o WhatsApp; o que veio de fora aparece abaixo.</p>
        {difs.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {difs.slice(0, 20).map((x, i) => <li key={i} className="flex items-start gap-2"><span className={clsx('mt-1.5 h-1.5 w-1.5 flex-none rounded-full', x.tipo === 'operador' ? 'bg-aviso-ponto' : 'bg-ruim-ponto')} />{x.texto}</li>)}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {ops.length > 0 && (
            <button type="button" className="btn" onClick={() => {
              const res = actions.whatsappMudar((mm, dd) => usarOcupantesDoBenCalls(mm, st.layouts, st.ocupacao, dd), { acao: 'WhatsApp: ocupantes do BenCalls', detalhe: `${ops.length} baia(s)` });
              toast(`${res.trocas} operador(es) atualizados no WhatsApp.`);
            }}>
              <RefreshCw size={15} /> Usar os ocupantes do BenCalls ({ops.length})
            </button>
          )}
          {faltando.length > 0 && <button type="button" className="btn" onClick={adicionarFaltando}>Adicionar as mesas que faltam ({faltando.length})</button>}
        </div>
      </section>

      <ApiIntegracao />

      {previa && (
        <Modal title="Importar mapa do BenHermes" onClose={() => setPrevia(null)}
          footer={<>
            <button type="button" className="btn btn-ghost" onClick={() => setPrevia(null)}>Voltar</button>
            <button type="button" className="btn btn-primary" onClick={() => { actions.whatsappSubstituir(previa.mapa, previa.nome); setPrevia(null); toast('Mapa do WhatsApp substituído.'); }}>Substituir mapa</button>
          </>}>
          <div className="flex flex-col gap-2 text-sm">
            <p><b>{previa.nome}</b></p>
            <p>{previa.mapa.salas.map((s) => `${s.nome}: ${s.mesas.map((m) => m.sigla).join(', ')}`).join(' · ')}</p>
            <p>{previa.mapa.celulares.length} celulares · {previa.mapa.historico.length} mudanças no histórico · {previa.mapa.manutencoes.length} manutenções</p>
            {(() => {
              const dd = divergencias(previa.mapa, st.layouts, st.ocupacao);
              return dd.length ? <Note tipo="warn">{dd.length} diferença(s) com as baias do BenCalls. Depois de importar, dá para usar os ocupantes daqui.</Note> : <Note tipo="ok">Bate com as baias do BenCalls.</Note>;
            })()}
            <p className="text-xs text-mudo">O mapa atual é trocado por este (exporte antes, se quiser guardar uma cópia).</p>
          </div>
        </Modal>
      )}
    </>
  );
}

// ------------------------------------------------------------------ API de integração (tempo real)
const ACAO_PARA_OK = { ANALISE: 'LIBERADO', PERMANENTE: 'TROCOU_CHIP', RESTRINGIDO: 'VOLTOU', BANIDO: 'LIBERADO' };
function ApiIntegracao() {
  const { st, actions, toast } = useStore();
  const [status, setStatus] = useState(null);
  const [baia, setBaia] = useState('');
  useEffect(() => { statusDaIntegracao().then(setStatus); }, []);
  const reg = st.integracao?.benhermes;
  // Baias com problema: as que o simulador pode "liberar" como se fosse a manutenção do BenHermes.
  const comProblema = useMemo(() => st.whatsapp.salas.flatMap((s) => s.mesas.flatMap((m) =>
    Object.entries(m.lugares).filter(([p, l]) => p !== 'SUB' && l.whatsapp.situacao !== 'OK' && l.whatsapp.situacao !== 'NAO_TEM')
      .map(([p, l]) => ({ codigo: `${m.sigla}-${p}`, situacao: l.whatsapp.situacao })))), [st.whatsapp]);
  const escolhida = comProblema.find((x) => x.codigo === baia) || comProblema[0];
  const simular = () => {
    if (!escolhida) return;
    const em = new Date().toISOString();
    const ev = {
      id: `simulado:${Date.now()}`, tipo: 'whatsapp.situacao', em,
      dados: { codigo: escolhida.codigo, de: escolhida.situacao, para: 'OK', acao: ACAO_PARA_OK[escolhida.situacao], estado: { situacao: 'OK', mudouEm: em }, manutencao: { id: 'simulada', janela: 'MANHA' } }
    };
    const efeitos = actions.aplicarEventosBenHermes([ev]);
    const fechados = efeitos.filter((e) => e.tipo === 'chamado-concluido');
    toast(fechados.length ? `${escolhida.codigo} OK. Chamado ${fechados.map((e) => numeroChamado(e.chamadoId)).join(', ')} concluído.` : `${escolhida.codigo} OK (não havia chamado de WhatsApp aberto nesta baia).`);
    setBaia('');
  };
  return (
    <section className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2>API de integração (tempo real)</h2>
        {status && <span className={clsx('badge', status.ativa ? 'b-ok' : 'b-gray')}>{status.ativa ? 'Ligada · recebendo do BenHermes' : 'Desligada neste servidor'}</span>}
      </div>
      <p className="text-sm text-tinta-2">
        O BenHermes avisa o BenCalls a cada mudança de WhatsApp e a cada manutenção concluída
        (<span className="font-mono">POST /api/integracoes/benhermes/eventos</span>, assinado com um segredo combinado).
        Quando um número volta a ficar OK, o WhatsApp da baia é atualizado aqui e o chamado de WhatsApp aberto naquela baia é <b>concluído</b>.
        {!status?.ativa && <> Para ligar, configure <span className="font-mono">BENHERMES_SEGREDO</span> nos dois servidores (veja <span className="font-mono">docs/API-INTEGRACAO.md</span>).</>}
      </p>
      <div className="flex flex-wrap items-end gap-2 rounded-xl bg-superficie-2 p-3">
        <label className="field min-w-[220px] flex-1">Testar: simular a manutenção do BenHermes liberando a baia
          <select className="select" value={escolhida?.codigo || ''} onChange={(e) => setBaia(e.target.value)} disabled={!comProblema.length}>
            {comProblema.map((x) => <option key={x.codigo} value={x.codigo}>{x.codigo} · {TEXTO_SITUACAO[x.situacao]}</option>)}
            {!comProblema.length && <option>Nenhuma baia com problema</option>}
          </select>
        </label>
        <button type="button" className="btn btn-primary" disabled={!escolhida} onClick={simular}><PlugZap size={15} /> Simular evento</button>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-mudo">Últimos eventos recebidos</span>
        {!reg?.log?.length && <span className="text-sm text-mudo">Nenhum ainda.</span>}
        {(reg?.log || []).slice(0, 10).map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className={clsx('badge badge-sm', l.resultado === 'aplicado' ? 'b-ok' : 'b-gray')}>{l.resultado}</span>
            <span>{l.texto}</span>
            <span className="text-xs text-mudo">· {dataHora(l.em)}{l.motivo ? ` · ${l.motivo}` : ''}{l.id.startsWith('simulado:') ? ' · simulado' : ''}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
