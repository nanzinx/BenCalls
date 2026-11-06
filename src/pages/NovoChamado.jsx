import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { Map as MapIcon, FileText, Check, ArrowLeft, ArrowRight, PartyPopper, MessageSquare, AlertTriangle, Info, CircleSlash, PenLine, Send } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { baiaCodigo, codigoItem, itensDaBaia, layoutsDoUsuario, subDoItem, indiceCatalogo, nomeItem, chamadosDaBaia, layoutById } from '../store/selectors.js';
import { alertaTriagem, detectarIncidentes, prioridadePorImpacto, slaDaPrioridade } from '../lib/rules.ts';
import { numeroChamado } from '../lib/format.ts';
import { PageHead, Seg, Pills, Note, PrioBadge, StatusBadge, Field, AjudaSla } from '../components/ui.jsx';
import { posicoesDaMesa, posKey } from '../lib/labels.ts';
import DeskMap, { Legenda } from '../components/DeskMap.jsx';
import { PassosTriagem, progressoTriagem, BarraProgresso, AnexoFoto, AvisoRapido, MIN_MOTIVO } from '../components/Triagem.jsx';
import { BannerIncidentes } from './MeusChamados.jsx';

const MIN_OUTROS = 10;
const MIN_DESC_FORM = 20;

function Etapas({ atual }) {
  const nomes = ['Escolher a baia', 'Marcar item e situação', 'Triagem guiada', 'Chamado'];
  return (
    <nav className="steps" aria-label="Etapas">
      {nomes.map((n, i) => (
        <div key={n} className={`step${i === atual ? ' now' : i < atual ? ' done' : ''}`} aria-current={i === atual ? 'step' : undefined}>
          <span className="n">{i < atual ? <Check size={13} /> : i + 1}</span>{n}
        </div>
      ))}
    </nav>
  );
}

function ChamadoCriado({ id, onVoltar, voltarLabel }) {
  const { st } = useStore();
  const { abrir } = useOutletContext();
  const c = st.chamados.find((x) => x.id === id);
  if (!c) return null;
  const onde = c.layoutId ? baiaCodigo(st, c.layoutId, c.pos) : c.local || 'Sem baia';
  return (
    <section className="card card-pad-0 max-w-[760px] w-full mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-marca text-sobre-marca py-5 px-6">
        <div><span className="text-xs opacity-[0.85]">Chamado aberto</span><h2 className="text-[26px] text-inherit">{numeroChamado(c.id)}</h2></div>
        <div className="flex flex-wrap items-center gap-2"><PrioBadge prio={c.prioridade} sm={false} /><StatusBadge status={c.status} /></div>
      </div>
      <div className="flex flex-col gap-3 p-6">
        <div className="detail-grid">
          <div><div className="lbl">Baia / local</div><div className="val">{onde}</div></div>
          <div><div className="lbl">Ocupante no momento</div><div className="val">{c.ocupante}</div></div>
          <div><div className="lbl">Categoria</div><div className="val">{c.categoria} › {c.sub}</div></div>
          <div><div className="lbl">SLA</div><div className="val">{c.slaMin >= 60 ? `${c.slaMin / 60}h` : `${c.slaMin} min`} ({c.prioridade.toLowerCase()})</div></div>
        </div>
        {c.itens.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-mudo">Itens (código gerado pelo sistema)</span>
            {c.itens.map((i) => {
              const it = st.itens.find((x) => x.id === i.assetId);
              return <div key={i.assetId} className="flex flex-wrap items-center gap-2 border border-linha rounded-[10px] py-2 px-3"><span className="tag">{codigoItem(st, it)}</span><b>{nomeItem(i.tipo)}</b><span className="text-xs text-mudo">{i.situacao}</span></div>;
            })}
          </div>
        )}
        {c.alerta && <Note tipo="bad"><b>Alerta para o TI:</b> {c.alerta}</Note>}
        {c.outros && <Note tipo="gray"><b>Fila de revisão de “Outros”:</b> o TI vai reclassificar este chamado e, se o problema se repetir, criar uma nova situação no catálogo.</Note>}
        {c.anexos.length > 0 && <Note tipo="warn">Foto anexada. O TI classifica a causa do dano no laudo técnico antes de fechar o chamado.</Note>}
        <Note tipo="info" icon={MessageSquare}>Aviso enviado ao <b>grupo do {c.depto}</b>{c.layoutId ? <> e ao <b>grupo do supervisor</b></> : null} no {st.modulos.benhub ? 'BenHub' : 'e-mail'}.</Note>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button type="button" className="btn btn-lg" onClick={() => abrir({ ch: c.id })}>Ver chamado</button>
          <button type="button" className="btn btn-primary btn-lg" onClick={onVoltar}>{voltarLabel}</button>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ MAPA
function PorMapa() {
  const { st, user, actions, toast, agora } = useStore();
  const [sp, setSp] = useSearchParams();
  const { abrir } = useOutletContext();
  const mesas = layoutsDoUsuario(st, user);
  const pre = sp.get('baia')?.split(':');
  const [mesaId, setMesaId] = useState(pre?.[0] || sp.get('mesa') || mesas[0]?.id);
  const [sel, setSel] = useState(pre?.[1] || null);
  const [picks, setPicks] = useState({}); // key -> { sitId, texto }
  const [ordem, setOrdem] = useState([]);
  const [detalhe, setDetalhe] = useState('');
  const [tela, setTela] = useState('mapa');
  const [regs, setRegs] = useState({});
  const [fotos, setFotos] = useState({});
  const [criado, setCriado] = useState(null);
  const [erro, setErro] = useState('');
  const { sits, subs } = useMemo(() => indiceCatalogo(st), [st]);

  useEffect(() => {
    if (sp.get('baia') || sp.get('mesa')) { const n = new URLSearchParams(sp); n.delete('baia'); n.delete('mesa'); setSp(n, { replace: true }); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // No celular o painel fica abaixo do mapa: leva o usuário até ele.
    if (sel && window.innerWidth < 900) setTimeout(() => document.getElementById('painel-baia')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, [sel]);

  const L = layoutById(st, mesaId) || mesas[0];
  if (!L) return <Note tipo="warn">Nenhuma mesa vinculada ao seu usuário. Peça ao TI para associar sua equipe no editor de espaços.</Note>;

  const limpar = () => { setSel(null); setPicks({}); setOrdem([]); setDetalhe(''); setTela('mapa'); setRegs({}); setFotos({}); setErro(''); };
  const code = sel ? baiaCodigo(st, L.id, sel) : '';
  const ocup = sel ? st.ocupacao[`${L.id}:${sel}`]?.nome || 'Sem ocupante' : '';
  const itens = sel ? itensDaBaia(st, L.id, sel) : [];
  const abertosBaia = sel ? chamadosDaBaia(st, L.id, sel, { abertos: true }) : [];
  const subBaia = subs.b9;
  const opcoes = [
    ...itens.map((it) => ({ key: it.id, it, sub: subDoItem(st, it.tipo), code: codigoItem(st, it), nome: nomeItem(it.tipo) })),
    { key: 'BAIA', it: null, sub: subBaia, code: 'Sem etiqueta', nome: 'Problema na baia (sem item)' }
  ];
  const opc = Object.fromEntries(opcoes.map((o) => [o.key, o]));
  const marcados = ordem.filter((k) => picks[k]?.sitId);
  const semSit = ordem.some((k) => !picks[k]?.sitId);
  const outrosOk = ordem.every((k) => !sits[picks[k]?.sitId]?.outros || (picks[k].texto || '').trim().length >= MIN_OUTROS);
  const podeContinuar = marcados.length > 0 && !semSit && outrosOk;

  const toggle = (k) => {
    if (picks[k]) { const p = { ...picks }; delete p[k]; setPicks(p); setOrdem(ordem.filter((x) => x !== k)); }
    else { setPicks({ ...picks, [k]: { sitId: null, texto: '' } }); setOrdem([...ordem, k]); }
  };

  // --------- triagem
  const blocos = marcados.map((k) => {
    const o = opc[k];
    const x = sits[picks[k].sitId];
    return { k, o, x, passos: (x.passos || []).map((t, j) => ({ key: `${k}#${j}`, texto: t, cod: o.code })) };
  });
  const todosPassos = blocos.flatMap((b) => (b.x.dano || b.x.outros ? [] : b.passos));
  const prog = progressoTriagem(todosPassos, regs);
  const faltaFoto = blocos.some((b) => b.x.dano && !fotos[b.k]);
  const podeAbrir = prog.falta === 0 && !faltaFoto;
  const registros = todosPassos.filter((p) => regs[p.key]).map((p) => ({ texto: `${p.cod} · ${p.texto}`, st: regs[p.key].st, motivo: (regs[p.key].motivo || '').trim(), at: regs[p.key].at }));
  const rapido = !!alertaTriagem(registros) && prog.feitos >= 2;
  const parado = blocos.some((b) => b.x.para);
  const prioPrev = blocos.length ? prioridadePorImpacto(blocos.map((b) => b.x.sub.prio).sort((a, b) => ['Crítica', 'Alta', 'Média', 'Baixa'].indexOf(a) - ['Crítica', 'Alta', 'Média', 'Baixa'].indexOf(b))[0], parado) : null;
  const incidentes = detectarIncidentes(st.chamados, { agora });

  const abrirChamado = () => {
    try {
      const textosOutros = blocos.filter((b) => b.x.outros).map((b) => `${b.o.nome}: ${picks[b.k].texto.trim()}`);
      const id = actions.abrirChamado({
        layoutId: L.id, pos: sel,
        itens: blocos.map((b) => ({ assetId: b.o.it?.id || null, tipo: b.o.it?.tipo || null, sitId: b.x.id, texto: picks[b.k].texto })),
        triagem: registros, anexos: Object.values(fotos).filter(Boolean),
        descricao: [...textosOutros, detalhe.trim()].filter(Boolean).join('\n'),
        textoOutros: textosOutros[0]?.split(': ').slice(1).join(': ')
      });
      setCriado(id);
      setTela('chamado');
    } catch (e) { setErro(e.message); }
  };
  const resolveu = () => {
    blocos.filter((b) => b.passos.length && !b.x.dano && !b.x.outros).forEach((b) => actions.registrarTriagemResolvida({ sitId: b.x.id, subId: b.x.sub.id, situacao: b.x.nome, layoutId: L.id, pos: sel }));
    setTela('resolvido');
  };

  const etapa = { mapa: sel ? 1 : 0, triagem: 2, resolvido: 3, chamado: 3 }[tela];

  return (
    <div className="flex flex-col gap-5">
      <Etapas atual={etapa} />

      {tela === 'mapa' && (
        <div className="split">
          <section className="main card flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-marca-txt">{L.sala} — {L.nome} <span className="text-mudo font-medium">({L.base})</span></h2>
                <p className="text-xs text-mudo mt-1">Clique na baia com problema. Você não precisa saber o código da etiqueta.</p>
              </div>
              <Legenda />
            </div>
            {mesas.length > 1 && (
              <Pills label="Mesa" value={L.id} onChange={(v) => { setMesaId(v); limpar(); }} options={mesas.map((m) => ({ value: m.id, label: `${m.base}` }))} />
            )}
            <DeskMap layout={L} sel={sel} onPick={(k) => { if (k !== sel) { setSel(k); setPicks({}); setOrdem([]); } }} mostrarChamado />
          </section>

          <aside id="painel-baia" className="side card flex flex-col gap-3 sticky-lado" aria-live="polite">
            {!sel ? (
              <div className="flex flex-col gap-1.5 py-3 px-0">
                <h2 className="text-marca-txt">Nenhuma baia selecionada</h2>
                <p className="text-mudo">Selecione uma baia no mapa para ver os itens instalados e marcar o que está com problema.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap justify-between gap-3 items-start">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-mudo">Baia selecionada</span>
                    <h2 className="font-mono text-[22px] text-marca-txt">{code}</h2>
                    <span className="text-xs">Ocupante agora: <b>{ocup}</b></span>
                  </div>
                  <button type="button" className="btn btn-sm" onClick={() => abrir({ baia: `${L.id}:${sel}` })}>Histórico</button>
                </div>
                {abertosBaia.length > 0 && (
                  <Note tipo="warn">Esta baia já tem {abertosBaia.length > 1 ? `${abertosBaia.length} chamados abertos` : 'um chamado aberto'}: {abertosBaia.map((c) => (
                    <button key={c.id} type="button" className="btn btn-sm btn-ghost min-h-0 py-0 px-1" onClick={() => abrir({ ch: c.id })}>{numeroChamado(c.id)} ({c.titulo})</button>
                  ))}. Confira antes de abrir outro para o mesmo problema.</Note>
                )}
                <b className="text-xs">1. Marque o item com problema</b>
                <div className="flex flex-col gap-1.5">
                  {opcoes.map((o) => {
                    const on = !!picks[o.key];
                    const p = picks[o.key];
                    const dup = o.it && abertosBaia.find((c) => c.itens.some((i) => i.assetId === o.it.id));
                    return (
                      <div key={o.key} className={`item-pick${on ? ' on' : ''}`}>
                        <button type="button" onClick={() => toggle(o.key)} aria-pressed={on} disabled={!o.sub}>
                          <span className={`box${on ? ' on' : ''}`}>{on && <Check size={14} />}</span>
                          <span className="sigla">{o.it ? o.it.tipo : '—'}</span>
                          <span className="flex flex-col min-w-0 flex-auto gap-0">
                            <b>{o.nome}</b>
                            <span className="text-[11px] text-mudo">{o.code}{o.it ? ` · ${o.it.status}` : ' · cadeira, tomada, mobiliário'}{dup ? ` · chamado ${numeroChamado(dup.id)} aberto` : ''}</span>
                          </span>
                        </button>
                        {on && (
                          <div className="flex flex-col gap-1.5 pt-1.5 pr-0 pb-1 pl-8">
                            <span className="text-xs text-tinta-2">2. Qual é a situação?</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {o.sub.sits.filter((x) => !x.solicitacao).map((x) => (
                                <button key={x.id} type="button" className="pill pill-accent min-h-[34px] text-[12.5px]" aria-pressed={p.sitId === x.id} onClick={() => setPicks({ ...picks, [o.key]: { ...p, sitId: x.id } })}>
                                  {x.nome}{incidentes.some((i) => i.sitId === x.id) && <AlertTriangle size={12} aria-label="problema conhecido" />}
                                </button>
                              ))}
                            </div>
                            {sits[p.sitId]?.outros && (
                              <label className="field">Descreva o problema (obrigatório)
                                <textarea className="textarea" rows={3} value={p.texto} onChange={(e) => setPicks({ ...picks, [o.key]: { ...p, texto: e.target.value } })} placeholder="Ex.: cadeira da baia quebrada, tomada sem energia…" />
                                <span className={`hint ${(p.texto || '').trim().length < MIN_OUTROS ? 'bad' : 'ok'}`}>{(p.texto || '').trim().length < MIN_OUTROS ? `Faltam ${MIN_OUTROS - (p.texto || '').trim().length} caracteres` : 'Descrição ok'}</span>
                              </label>
                            )}
                            {sits[p.sitId]?.dano && <span className="text-[11px] text-mudo">Dano físico: não tem triagem, mas pede foto na próxima etapa.</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <label className="field">3. Detalhar melhor (opcional)
                  <textarea className="textarea" rows={3} value={detalhe} onChange={(e) => setDetalhe(e.target.value)} placeholder="Desde quando acontece, o que já foi tentado, horário em que piora…" />
                </label>
                <button type="button" className="btn btn-primary btn-lg" disabled={!podeContinuar} onClick={() => { setTela('triagem'); setRegs({}); setFotos({}); }}>
                  {podeContinuar ? <>Continuar para a triagem <ArrowRight size={16} /></> : !ordem.length ? 'Marque um item e a situação' : semSit ? 'Escolha a situação do item' : 'Descreva o problema em “Outros”'}
                </button>
              </>
            )}
          </aside>
        </div>
      )}

      {tela === 'triagem' && (
        <section className="card flex flex-col gap-5 max-w-[860px] w-full mx-auto">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-mudo">Baia {code} · {ocup}</span>
            <h2 className="text-[22px] text-marca-txt">Antes de abrir, tente estes passos</h2>
            <p className="text-mudo">Muitos problemas se resolvem aqui mesmo. O chamado só pode ser aberto depois que todos os passos forem marcados como feitos (ou como não possíveis, com o motivo).</p>
          </div>
          <BarraProgresso feitos={prog.feitos} total={prog.total} />
          {incidentes.filter((i) => blocos.some((b) => b.x.id === i.sitId)).map((i) => (
            <Note key={i.sitId} tipo="bad"><b>Problema conhecido:</b> já existem {i.chamados.length} chamados de “{sits[i.sitId].nome}” na última hora. Pode ser um incidente geral — o TI já está ciente.</Note>
          ))}
          {blocos.map((b) => (
            <div key={b.k} className="card card-flat flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2"><b className="text-marca-txt">{b.o.nome}</b><span className="tag">{b.o.code}</span><span className="badge b-warn">{b.x.nome}</span>{b.x.para && <span className="badge badge-sm b-bad">operador parado</span>}</div>
              {b.x.outros && (
                <>
                  <p className="bg-superficie-2 rounded-[8px] py-2.5 px-3 whitespace-pre-line">{picks[b.k].texto.trim()}</p>
                  <span className="text-xs text-mudo">Situação fora do catálogo: não há triagem. O chamado entra na fila de revisão do TI.</span>
                </>
              )}
              {b.x.dano && (
                <>
                  <span className="text-xs text-tinta-2">Item danificado não passa por triagem. Anexe uma foto para o laudo técnico do TI.</span>
                  <AnexoFoto nome={fotos[b.k]} onChange={(n) => setFotos({ ...fotos, [b.k]: n })} obrigatorio />
                </>
              )}
              {!b.x.dano && !b.x.outros && b.passos.length > 0 && <PassosTriagem passos={b.passos} regs={regs} setReg={(k, r) => setRegs((x) => { const n = { ...x }; if (r) n[k] = r; else delete n[k]; return n; })} />}
              {!b.x.dano && !b.x.outros && !b.passos.length && <span className="text-xs text-mudo">Esta situação não tem passos de triagem.</span>}
            </div>
          ))}
          {rapido && <AvisoRapido />}
          {prioPrev && <span className="text-xs text-mudo">Prioridade prevista: <b>{prioPrev}</b>{parado ? ' (operador sem conseguir trabalhar)' : ''} · SLA de {slaDaPrioridade(prioPrev, blocos[0].x.sub.sla)} min</span>}
          {erro && <Note tipo="bad">{erro}</Note>}
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button type="button" className="btn btn-lg" onClick={() => setTela('mapa')}><ArrowLeft size={16} /> Voltar</button>
            {todosPassos.length > 0 && <button type="button" className="btn btn-lg text-ok border-ok-ponto" onClick={resolveu}><Check size={16} /> Resolveu, não precisa de chamado</button>}
            <button type="button" className="btn btn-primary btn-lg" disabled={!podeAbrir} onClick={abrirChamado}>
              {podeAbrir ? 'Não resolveu, abrir chamado' : prog.falta > 0 ? `Conclua a triagem (falta${prog.falta > 1 ? 'm' : ''} ${prog.falta} passo${prog.falta > 1 ? 's' : ''})` : 'Anexe a foto para abrir'}
            </button>
          </div>
        </section>
      )}

      {tela === 'resolvido' && (
        <section className="card flex flex-col gap-3 max-w-[620px] w-full p-8 items-start mx-auto">
          <span className="w-[52px] h-[52px] rounded-full bg-ok-fundo text-ok grid place-items-center"><PartyPopper size={26} /></span>
          <h2 className="text-[22px] text-marca-txt">Resolvido na triagem</h2>
          <p className="leading-[1.6]">Nenhum chamado foi aberto. O registro entra no relatório de triagem da baia <b>{code}</b>, para o TI saber quais passos mais resolvem.</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => { limpar(); toast('Obrigado! Menos um chamado na fila do TI.'); }}>Voltar ao mapa</button>
        </section>
      )}

      {tela === 'chamado' && criado && <ChamadoCriado id={criado} onVoltar={limpar} voltarLabel="Voltar ao mapa" />}
    </div>
  );
}

// ------------------------------------------------------------------ FORMULÁRIO
function PorFormulario() {
  const { st, actions } = useStore();
  const [cat, setCat] = useState(null);
  const [subId, setSubId] = useState(null);
  const [sitId, setSitId] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [titEditado, setTitEditado] = useState(false);
  const [desc, setDesc] = useState('');
  const [local, setLocal] = useState('');
  const [depto, setDepto] = useState('TI');
  const [foto, setFoto] = useState(null);
  const [regs, setRegs] = useState({});
  const [criado, setCriado] = useState(null);
  const [erro, setErro] = useState('');
  const { sits } = useMemo(() => indiceCatalogo(st), [st]);

  const C = st.catalogo.find((c) => c.id === cat);
  const S = C?.subs.find((s) => s.id === subId);
  const X = sitId ? sits[sitId] : null;
  const tituloAuto = X ? `${S.nome} — ${X.nome}` : '';
  const tit = titEditado ? titulo : tituloAuto;
  const passos = X && !X.dano && !X.outros ? (X.passos || []).map((t, j) => ({ key: `f#${j}`, texto: t })) : [];
  const prog = progressoTriagem(passos, regs);
  const faltaDesc = Math.max(0, MIN_DESC_FORM - desc.trim().length);
  const bloqueio = !X ? 'Escolha a categoria e a situação'
    : faltaDesc > 0 ? `Descreva o problema (faltam ${faltaDesc} caracteres)`
    : prog.falta > 0 ? `Conclua a triagem (falta${prog.falta > 1 ? 'm' : ''} ${prog.falta} passo${prog.falta > 1 ? 's' : ''})`
    : X.dano && !foto ? 'Anexe a foto para abrir' : '';

  const reset = () => { setCat(null); setSubId(null); setSitId(null); setTitulo(''); setTitEditado(false); setDesc(''); setLocal(''); setFoto(null); setRegs({}); setCriado(null); setErro(''); };
  const enviar = () => {
    try {
      const id = actions.abrirChamado({
        sitId, titulo: tit.trim() || tituloAuto, descricao: desc, local: local.trim(), depto,
        triagem: passos.filter((p) => regs[p.key]).map((p) => ({ texto: p.texto, st: regs[p.key].st, motivo: (regs[p.key].motivo || '').trim(), at: regs[p.key].at })),
        anexos: foto ? [foto] : []
      });
      setCriado(id);
    } catch (e) { setErro(e.message); }
  };

  if (criado) return <ChamadoCriado id={criado} onVoltar={reset} voltarLabel="Abrir outro chamado" />;

  return (
    <div className="split">
      <section className="main card flex flex-col gap-5">
        <p className="text-xs text-mudo">Para problemas que não estão ligados a uma baia: sistemas, acessos, rede, salas de reunião, solicitações (novo colaborador, desligamento, troca de baia) ou equipamentos fora do mapa.</p>
        <div className="flex flex-col gap-1.5">
          <b className="text-xs text-marca-txt">1. Categoria</b>
          <Pills label="Categoria" value={cat} onChange={(v) => { setCat(v); setSubId(null); setSitId(null); setRegs({}); setTitEditado(false); setDepto(st.catalogo.find((c) => c.id === v).equipe); }}
            options={st.catalogo.map((c) => ({ value: c.id, label: c.nome }))} />
        </div>
        {C && (
          <div className="flex flex-col gap-1.5">
            <b className="text-xs text-marca-txt">2. Tipo</b>
            <Pills label="Tipo" value={subId} onChange={(v) => { setSubId(v); setSitId(null); setRegs({}); setTitEditado(false); }} options={C.subs.map((s) => ({ value: s.id, label: s.nome }))} />
            {S?.item && <span className="text-xs text-laranja"><Info className="align-[-2px]" size={13} /> Problema num item de baia? Use o mapa: o chamado fica vinculado ao item e ao histórico da baia.</span>}
          </div>
        )}
        {S && (
          <div className="flex flex-col gap-1.5">
            <b className="text-xs text-marca-txt">3. Qual é a situação?</b>
            <Pills accent label="Situação" value={sitId} onChange={(v) => { setSitId(v); setRegs({}); setTitEditado(false); }} options={S.sits.map((s) => ({ value: s.id, label: s.nome }))} />
            <span className="text-xs text-mudo">Prioridade {S.prio} · SLA {S.sla >= 60 ? `${S.sla / 60}h` : `${S.sla} min`} (definidos no catálogo)</span>
          </div>
        )}
        {X && (
          <div className="flex flex-col gap-3">
            <b className="text-xs text-marca-txt">4. Detalhes do chamado</b>
            <Field label="Título"><input className="input" value={tit} onChange={(e) => { setTitulo(e.target.value); setTitEditado(true); }} /></Field>
            <Field label={`Descrição (obrigatória)`} hint={faltaDesc ? `Mínimo de ${MIN_DESC_FORM} caracteres · faltam ${faltaDesc}` : 'Descrição ok'} hintTone={faltaDesc ? 'bad' : 'ok'}>
              <textarea className="textarea" rows={5} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={X.outros ? 'Descreva o problema com suas palavras: o que aconteceu, desde quando e quem está afetado.' : X.solicitacao ? 'Nome da pessoa, data, acessos necessários e o que mais o TI precisa saber.' : 'O que está acontecendo, desde quando, quem está afetado e o que já foi tentado.'} />
            </Field>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-3">
              <Field label="Onde (opcional)"><input className="input" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: sala de reunião 2, recepção" /></Field>
              <div className="field">Departamento que vai atender<Pills label="Departamento" value={depto} onChange={setDepto} options={['TI', 'Facilities', 'RH']} /></div>
            </div>
            <AnexoFoto nome={foto} onChange={setFoto} obrigatorio={!!X.dano} />
          </div>
        )}
      </section>

      <aside className="side card flex flex-col gap-3 sticky-lado">
        <h2 className="text-marca-txt">Triagem antes de abrir</h2>
        {!X && <p className="text-xs text-mudo">Escolha a situação para ver os passos de verificação.</p>}
        {X?.outros && <p className="text-xs text-mudo">Situação fora do catálogo: não há triagem. Descreva bem o problema; o chamado entra na fila de revisão do TI.</p>}
        {X?.dano && <p className="text-xs text-mudo">Dano físico não passa por triagem. Anexe uma foto para o laudo técnico.</p>}
        {X?.solicitacao && <p className="text-xs text-mudo">Solicitação: não é defeito, então não tem triagem.</p>}
        {X && !X.outros && !X.dano && !X.solicitacao && !passos.length && <p className="text-xs text-mudo">Esta situação não tem passos de triagem.</p>}
        <BarraProgresso feitos={prog.feitos} total={prog.total} />
        {passos.length > 0 && <PassosTriagem passos={passos} regs={regs} setReg={(k, r) => setRegs((x) => { const n = { ...x }; if (r) n[k] = r; else delete n[k]; return n; })} />}
        {erro && <Note tipo="bad">{erro}</Note>}
        <button type="button" className="btn btn-primary btn-lg" disabled={!!bloqueio} onClick={enviar}>{bloqueio || 'Abrir chamado'}</button>
        {passos.length > 0 && !bloqueio && <span className="text-[11px] text-mudo">Os passos e horários vão junto com o chamado (RF07).</span>}
      </aside>
    </div>
  );
}

// ------------------------------------------------------------------ CHAMADO PRÓPRIO
const MIN_TITULO = 8;
const MAX_TITULO = 90;

/** Chamado com título próprio: para o que não cabe no catálogo. O TI classifica depois (fila de "Outros"). */
function ChamadoProprio() {
  const { st, user, actions } = useStore();
  const [titulo, setTitulo] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('');
  const [depto, setDepto] = useState('TI');
  const [local, setLocal] = useState('');
  const [baia, setBaia] = useState('');
  const [parado, setParado] = useState(false);
  const [foto, setFoto] = useState(null);
  const [criado, setCriado] = useState(null);
  const [erro, setErro] = useState('');
  const mesas = layoutsDoUsuario(st, user);
  const livre = st.catalogo.flatMap((c) => c.subs).find((x) => x.livre);
  // Com categoria escolhida, o chamado cai no "Outros" do primeiro tipo dela; sem categoria, em Geral › Chamado livre.
  const C = st.catalogo.find((c) => c.id === cat);
  const sub = C ? C.subs[0] : livre;
  const sit = sub?.sits.find((x) => x.outros);
  const prio = prioridadePorImpacto(sub?.prio || 'Média', parado);
  const sla = slaDaPrioridade(prio, sub?.sla);
  const tl = titulo.trim().length;
  const faltaDesc = Math.max(0, MIN_DESC_FORM - desc.trim().length);
  const bloqueio = tl < MIN_TITULO ? `Escreva um título (mín. ${MIN_TITULO} caracteres)` : faltaDesc ? `Descreva o problema (faltam ${faltaDesc} caracteres)` : '';
  const [layoutId, pos] = baia ? baia.split(':') : [null, null];

  const enviar = () => {
    try {
      const id = actions.abrirChamado({
        sitId: sit.id, titulo: titulo.trim(), descricao: desc, local: local.trim(), depto, parado,
        layoutId, pos, anexos: foto ? [foto] : [], triagem: []
      });
      setCriado(id);
    } catch (e) { setErro(e.message); }
  };
  const reset = () => { setTitulo(''); setDesc(''); setCat(''); setLocal(''); setBaia(''); setParado(false); setFoto(null); setCriado(null); setErro(''); };
  if (criado) return <ChamadoCriado id={criado} onVoltar={reset} voltarLabel="Abrir outro chamado" />;

  return (
    <div className="split">
      <section className="main card brilho flex flex-col gap-5">
        <p className="text-xs text-mudo">Não achou a situação no mapa nem no formulário? Escreva o chamado do seu jeito. O TI recebe na hora e depois classifica no catálogo; se o problema se repetir, ele vira uma opção oficial.</p>
        <Field label="Título do chamado" hint={`${tl}/${MAX_TITULO} · resuma o problema em uma frase`} hintTone={tl > 0 && tl < MIN_TITULO ? 'bad' : ''}>
          <input className="input text-[16px] font-semibold min-h-[48px]" maxLength={MAX_TITULO} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Impressora do RH imprimindo folhas em branco" autoFocus />
        </Field>
        <Field label="Descrição (obrigatória)" hint={faltaDesc ? `Mínimo de ${MIN_DESC_FORM} caracteres · faltam ${faltaDesc}` : 'Descrição ok'} hintTone={faltaDesc ? 'bad' : 'ok'}>
          <textarea className="textarea" rows={5} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="O que aconteceu, desde quando, quem está afetado e o que já foi tentado." />
        </Field>
        <div className="field">Assunto (opcional)
          <Pills label="Assunto" value={cat} onChange={(v) => { setCat(v); const c = st.catalogo.find((x) => x.id === v); if (c) setDepto(c.equipe); }}
            options={[{ value: '', label: 'Não sei, o TI classifica' }, ...st.catalogo.filter((c) => !c.subs.some((x) => x.livre)).map((c) => ({ value: c.id, label: c.nome }))]} />
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-3">
          <div className="field">Departamento que vai atender<Pills label="Departamento" value={depto} onChange={setDepto} options={['TI', 'Facilities', 'RH']} /></div>
          <Field label="Onde (opcional)"><input className="input" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: sala de reunião 2, recepção" /></Field>
          {mesas.length > 0 && (
            <Field label="Vincular a uma baia (opcional)" hint="Entra no histórico da baia">
              <select className="select" value={baia} onChange={(e) => setBaia(e.target.value)}>
                <option value="">— sem baia —</option>
                {mesas.map((L) => (
                  <optgroup key={L.id} label={`${L.base} · ${L.nome}`}>
                    {posicoesDaMesa(L).map((p) => <option key={posKey(p)} value={`${L.id}:${posKey(p)}`}>{baiaCodigo(st, L.id, posKey(p))}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
          )}
        </div>
        <label className="check"><input type="checkbox" checked={parado} onChange={(e) => setParado(e.target.checked)} /> Alguém está sem conseguir trabalhar por causa disso (a prioridade sobe)</label>
        <AnexoFoto nome={foto} onChange={setFoto} />
      </section>

      <aside className="side flex flex-col gap-3 sticky-lado">
        <div className="card flex flex-col gap-3">
          <span className="text-xs font-semibold text-mudo">Prévia do chamado</span>
          <div className="ticket cursor-default">
            <span className="t-top"><span className="t-num">#2026-{String(st.seqChamado).padStart(4, '0')} · agora</span><PrioBadge prio={prio} /></span>
            <span className="t-title" style={{ color: tl ? undefined : 'rgb(var(--mudo))' }}>{titulo.trim() || 'O título que você escrever aparece aqui'}</span>
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="tag">{baia ? baiaCodigo(st, layoutId, pos) : local.trim() || 'Sem baia'}</span>
              <span className="badge badge-sm b-outline">Outros · revisar</span>
            </span>
          </div>
          <div className="detail-grid">
            <div><div className="lbl">Prioridade</div><div className="val">{prio}{parado ? ' (pessoa parada)' : ''}</div></div>
            <div><div className="lbl flex flex-wrap items-center gap-1">SLA (prazo) <AjudaSla /></div><div className="val">{sla >= 60 ? `${sla / 60}h` : `${sla} min`}</div></div>
            <div><div className="lbl">Classificação</div><div className="val">{C ? `${C.nome} › Outros` : 'Geral › Chamado livre'}</div></div>
            <div><div className="lbl">Atende</div><div className="val">{depto}</div></div>
          </div>
          {erro && <Note tipo="bad">{erro}</Note>}
          <button type="button" className="btn btn-primary btn-lg" disabled={!!bloqueio} onClick={enviar}>{bloqueio || <><Send size={16} /> Abrir chamado</>}</button>
          <span className="text-[11px] text-mudo">Sem triagem: como o problema está fora do catálogo, não há passos prontos. O chamado entra na fila de revisão de “Outros” (RN11).</span>
        </div>
      </aside>
    </div>
  );
}

export default function NovoChamado() {
  const [sp] = useSearchParams();
  const [modo, setModo] = useState(['form', 'proprio'].includes(sp.get('modo')) ? sp.get('modo') : 'mapa');
  const nav = useNavigate();
  return (
    <>
      <PageHead title="Novo chamado" desc="Problema numa baia? Use o mapa. Sistemas, acessos e solicitações: formulário. Não achou o que precisa? Abra um chamado próprio, com o seu título.">
        <button type="button" className="btn btn-ghost" onClick={() => nav('/inicio')}><CircleSlash size={15} /> Cancelar</button>
      </PageHead>
      <BannerIncidentes />
      <Seg label="Como abrir o chamado" value={modo} onChange={setModo} options={[{ value: 'mapa', label: 'Pelo mapa da baia', icon: MapIcon }, { value: 'form', label: 'Formulário do catálogo', icon: FileText }, { value: 'proprio', label: 'Chamado próprio', icon: PenLine }]} />
      {modo === 'mapa' ? <PorMapa /> : modo === 'form' ? <PorFormulario /> : <ChamadoProprio />}
    </>
  );
}

export { MIN_MOTIVO };
