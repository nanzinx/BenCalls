import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { X, Paperclip, AlertTriangle, ListChecks, Wrench, UserCheck, Play, PauseCircle, Ban, ThumbsUp, ThumbsDown, RotateCcw, MessageSquarePlus, ArrowRightLeft, Sparkles, MapPin, ExternalLink, ChevronDown, Flame, Smartphone, Hourglass } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { baiaCodigo, codigoItem, indiceCatalogo, nomeItem, nomeUser, tem, itensDaBaia, layoutById } from '../store/selectors.js';
import { whatsappDaBaia } from '../lib/whatsapp-baias.ts';
import { etapaDoWhatsapp } from '../lib/estagios-whatsapp.ts';
import { EstagioWhatsapp } from './WhatsappUi.jsx';
import { numeroChamado, hhmmss, dataHora, idade } from '../lib/format.ts';
import { CAUSAS, podeReabrir, DISPONIVEL } from '../lib/rules.ts';
import { StatusBadge, PrioBadge, Note, PONTO_STATUS, ItemBadge } from './ui.jsx';

const FORMS = {
  pendente: { titulo: 'Por que o chamado ficará pendente?', ph: 'Ex.: aguardando peça do fornecedor', botao: 'Marcar como pendente', status: 'Pendente' },
  negar: { titulo: 'Justificativa da negativa', ph: 'Ex.: chamado duplicado do #2026-0131', botao: 'Negar chamado', status: 'Negado' },
  cancelar: { titulo: 'Motivo do cancelamento', ph: 'Ex.: o problema se resolveu sozinho', botao: 'Cancelar chamado', status: 'Cancelado' },
  devolver: { titulo: 'O que ainda não está funcionando?', ph: 'Ex.: o áudio voltou, mas o microfone continua mudo', botao: 'Devolver ao TI', status: 'reabrir' },
  reabrir: { titulo: 'Por que reabrir?', ph: 'Ex.: o problema voltou hoje de manhã', botao: 'Reabrir chamado', status: 'reabrir' }
};

function SolucaoForm({ c, onDone, onCancel }) {
  const { st, actions } = useStore();
  const [texto, setTexto] = useState('');
  const [causa, setCausa] = useState('');
  const [trocas, setTrocas] = useState({});
  const temItem = c.itens.some((i) => !i.instalado);
  const precisaLaudo = temItem; // RN02
  const itensChamado = c.itens.filter((i) => !i.instalado).map((i) => st.itens.find((x) => x.id === i.assetId)).filter(Boolean);
  const ok = texto.trim().length >= 5 && (!precisaLaudo || !!causa);

  const salvar = () => {
    actions.registrarSolucao(c.id, {
      texto: texto.trim(), causa: precisaLaudo ? causa : null,
      trocas: Object.entries(trocas).filter(([, t]) => t.on).map(([antigoId, t]) => ({ antigoId, novoId: t.novoId || null, destino: t.destino }))
    });
    onDone(causa === 'Mau uso' && st.modulos.dossie ? 'Solução registrada. Dossiê enviado ao RH. Aguardando a confirmação de quem abriu.' : 'Solução registrada. Aguardando a confirmação de quem abriu.');
  };

  return (
    <div className="card card-flat flex flex-col gap-3 bg-superficie-2">
      <b className="flex flex-wrap items-center gap-2"><Wrench size={16} /> Registrar solução</b>
      <label className="field">Descreva a solução
        <textarea className="textarea" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que foi feito para resolver?" />
      </label>
      {precisaLaudo && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold">Laudo técnico: qual foi a causa? <span className="text-mudo">(obrigatório)</span></span>
          <div className="flex flex-wrap items-center gap-1.5">
            {CAUSAS.map((k) => (
              <button key={k} type="button" className="pill" aria-pressed={causa === k} onClick={() => setCausa(k)}
                style={causa === k && k === 'Mau uso' ? { background: 'rgb(var(--ruim-ponto))', borderColor: 'rgb(var(--ruim-ponto))' } : undefined}>{k}</button>
            ))}
          </div>
          {causa === 'Mau uso' && (
            <Note tipo="bad">Gera um dossiê para o RH com chamado, laudo, fotos, ocupante e termo assinado. <b>O sistema nunca aplica desconto</b>: a decisão é do RH.</Note>
          )}
        </div>
      )}
      {itensChamado.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold flex flex-wrap items-center gap-2"><ArrowRightLeft size={14} /> Troca de item (baixa automática no estoque)</span>
          {itensChamado.map((it) => {
            const t = trocas[it.id] || { on: false, novoId: '', destino: 'Em manutenção' };
            const set = (patch) => setTrocas((x) => ({ ...x, [it.id]: { ...t, ...patch } }));
            const disponiveis = st.itens.filter((x) => x.tipo === it.tipo && DISPONIVEL.includes(x.status));
            return (
              <div key={it.id} className="item-pick flex flex-col gap-1.5 p-2.5">
                <label className="check"><input type="checkbox" checked={t.on} onChange={(e) => set({ on: e.target.checked })} />
                  Retirar <span className="tag">{codigoItem(st, it)}</span> <span className="text-mudo text-xs">{it.id}</span></label>
                {t.on && (
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-2.5">
                    <label className="field">Item retirado vai para
                      <select className="select" value={t.destino} onChange={(e) => set({ destino: e.target.value })}>
                        {['Em manutenção', 'Em garantia', 'Quebrado', 'Disponível (usado)'].map((d) => <option key={d}>{d}</option>)}
                      </select>
                    </label>
                    <label className="field">Instalar no lugar
                      <select className="select" value={t.novoId} onChange={(e) => set({ novoId: e.target.value })}>
                        <option value="">— não instalar agora —</option>
                        {disponiveis.map((x) => <option key={x.id} value={x.id}>{codigoItem(st, x)} · {x.id} · {x.status}</option>)}
                      </select>
                      {!disponiveis.length && <span className="hint bad">Nenhum {nomeItem(it.tipo).toLowerCase()} disponível no almoxarifado.</span>}
                    </label>
                  </div>
                )}
              </div>
            );
          })}
          <span className="text-[11px] text-mudo">A etiqueta nova é gerada na hora: o item instalado assume o código da baia e o retirado ganha código do local (ALM/MNT/GAR). O ID interno não muda.</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" disabled={!ok} onClick={salvar}>Registrar solução</button>
        <button type="button" className="btn" onClick={onCancel}>Voltar</button>
        {!ok && <span className="text-xs text-mudo">{texto.trim().length < 5 ? 'Descreva a solução.' : 'Escolha a causa do laudo.'}</span>}
      </div>
    </div>
  );
}

export default function TicketDetail({ id, onClose, abrir }) {
  const { st, user, actions, toast, agora, paraMimIds } = useStore();
  const c = st.chamados.find((x) => x.id === id);
  // Abrir o chamado conta como "visto": sai do aviso "para você".
  const naoVisto = paraMimIds.has(id);
  useEffect(() => { if (naoVisto) actions.marcarVistos([id]); }, [id, naoVisto, actions]);
  const tecnicos = useMemo(() => st.usuarios.filter((u) => u.ativo !== false && tem(u, 'ASC')), [st.usuarios]);
  const [form, setForm] = useState(null);
  const [txt, setTxt] = useState('');
  const [coment, setComent] = useState('');
  const [aba, setAba] = useState('resumo');
  const { sits } = useMemo(() => indiceCatalogo(st), [st]);
  if (!c) return null;

  const souDono = c.remetenteId === user.id;
  const ti = tem(user, 'ASC');
  const F = form && FORMS[form];
  const baia = c.layoutId ? baiaCodigo(st, c.layoutId, c.pos) : null;
  const sit = sits[c.sitId];
  // Chamado de WhatsApp: acompanha o estágio do número no Controle de WhatsApps. Em análise ou
  // restringido não há manutenção a fazer, então "Iniciar execução" e "Registrar solução" esperam.
  const Lw = sit?.whatsapp && c.layoutId && st.modulos.whatsapp ? layoutById(st, c.layoutId) : null;
  const wpp = Lw ? whatsappDaBaia(st.whatsapp, Lw.base, c.pos, new Date(agora)) : null;
  const esperandoWhatsapp = !!wpp && etapaDoWhatsapp(wpp.estado, new Date(agora)).aguardandoWhatsapp && !['Concluído', 'Cancelado', 'Negado', 'Aguardando Consenso'].includes(c.status);
  const acoes = [];
  if (!form) {
    if (ti && !c.tecnicoId && ['Em Análise', 'Pendente'].includes(c.status)) acoes.push({ l: 'Assumir', i: UserCheck, run: () => { actions.assumir(c.id); toast(`Você assumiu ${numeroChamado(c.id)}.`); } });
    if (ti && !esperandoWhatsapp && ['Em Análise', 'Pendente'].includes(c.status)) acoes.push({ l: 'Iniciar execução', i: Play, cls: 'btn-primary', run: () => { actions.iniciarExecucao(c.id); toast(`${numeroChamado(c.id)} em execução.`); } });
    if (ti && ['Em Análise', 'Em Execução'].includes(c.status)) acoes.push({ l: 'Marcar como pendente', i: PauseCircle, run: () => setForm('pendente') });
    if (ti && !esperandoWhatsapp && c.status === 'Em Execução') acoes.push({ l: 'Registrar solução', i: Wrench, cls: 'btn-primary', run: () => setForm('solucao') });
    if (ti && ['Em Análise', 'Pendente'].includes(c.status)) acoes.push({ l: 'Negar', i: Ban, cls: 'btn-danger', run: () => setForm('negar') });
    if (souDono && c.status === 'Aguardando Consenso') {
      acoes.push({ l: 'Sim, foi resolvido', i: ThumbsUp, cls: 'btn-ok', run: () => { actions.confirmarSolucao(c.id); toast(`Chamado ${numeroChamado(c.id)} concluído. Obrigado pela confirmação.`); } });
      acoes.push({ l: 'Não, continua com problema', i: ThumbsDown, cls: 'btn-danger', run: () => setForm('devolver') });
    }
    if (souDono && c.status === 'Em Análise') acoes.push({ l: 'Cancelar chamado', i: Ban, cls: 'btn-danger', run: () => setForm('cancelar') });
    if ((souDono || ti) && podeReabrir(c, agora)) acoes.push({ l: 'Reabrir', i: RotateCcw, run: () => setForm('reabrir') });
  }

  const confirmar = () => {
    const just = txt.trim();
    if (F.status === 'reabrir') actions.reabrir(c.id, just);
    else actions.mudarStatus(c.id, F.status, just);
    toast(`${numeroChamado(c.id)}: ${F.botao.toLowerCase()} feito.`);
    setForm(null);
    setTxt('');
  };

  const podeVirarPasso = ti && c.solucao && sit && !sit.outros && !sit.dano && !sit.solicitacao && !(sit.passos || []).includes(c.solucao.texto);

  const outrosDaBaia = baia ? st.chamados.filter((x) => x.layoutId === c.layoutId && x.pos === c.pos && x.id !== c.id).sort((a, b) => b.criadoEm - a.criadoEm) : [];
  const ABAS = [
    { id: 'resumo', l: 'Resumo' },
    { id: 'triagem', l: 'Triagem', n: c.triagem.length },
    { id: 'comentarios', l: 'Comentários', n: (c.comentarios || []).length },
    { id: 'historico', l: 'Histórico', n: c.hist.length }
  ];
  const finalizado = ['Concluído', 'Cancelado', 'Negado'].includes(c.status);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-2.5 border-b border-linha bg-superficie/95 px-5 pt-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-semibold text-mudo">{numeroChamado(c.id)} · {c.categoria} › {c.sub}</span>
            <h2 className="text-lg leading-snug text-tinta">{c.titulo}</h2>
          </div>
          <button type="button" className="btn btn-ghost btn-icon flex-none" onClick={onClose} aria-label="Fechar detalhe"><X size={18} /></button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={c.status} />
          <PrioBadge prioritario={c.prioritario} sm={false} />
          {c.operadorParado && !finalizado && <span className="badge b-bad">Operador parado</span>}
          {c.reaberturas > 0 && <span className="badge b-orange">Reaberto {c.reaberturas}×</span>}
          {ti && !finalizado && (
            <button type="button" className="btn btn-sm btn-ghost ml-auto text-mudo" aria-pressed={!!c.prioritario}
              onClick={() => { actions.definirPrioridade(c.id, !c.prioritario); toast(c.prioritario ? 'Prioridade retirada.' : `${numeroChamado(c.id)} marcado como prioritário.`); }}>
              <Flame size={14} className={c.prioritario ? 'text-ruim' : ''} /> {c.prioritario ? 'Tirar prioridade' : 'Marcar prioritário'}
            </button>
          )}
        </div>
        <nav className="abas" role="tablist" aria-label="Seções do chamado">
          {ABAS.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className="aba" onClick={() => setAba(a.id)}>
              {a.l}{a.n > 0 && <span className="aba-n">{a.n}</span>}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {form === 'solucao' && <SolucaoForm c={c} onCancel={() => setForm(null)} onDone={(m) => { setForm(null); toast(m); }} />}
        {F && (
          <div className="card card-flat flex animate-surgir flex-col gap-2 bg-superficie-2">
            <label className="field">{F.titulo}
              <textarea className="textarea" rows={3} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={F.ph} autoFocus />
            </label>
            {form === 'devolver' && <span className="text-xs text-mudo">Volta para “Em Execução” com o seu comentário no histórico.</span>}
            {form === 'reabrir' && <span className="text-xs text-mudo">Volta para o mesmo técnico e conta como reabertura.</span>}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={`btn ${form === 'negar' || form === 'cancelar' ? 'btn-danger' : 'btn-primary'}`} disabled={txt.trim().length < 5} onClick={confirmar}>{F.botao}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setForm(null); setTxt(''); }}>Voltar</button>
            </div>
          </div>
        )}

        {aba === 'resumo' && (
          <>
            {c.alerta && <Note tipo="bad"><b>Alerta de triagem:</b> {c.alerta}</Note>}
            {c.outros && !c.outrosRevisado && <Note tipo="gray">Fora do catálogo: na fila de revisão do TI.</Note>}
            {wpp && !finalizado && (
              <section className="flex flex-col gap-2 rounded-xl border border-linha p-3" aria-label="WhatsApp da baia">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-mudo"><Smartphone size={14} /> WhatsApp da baia {wpp.codigo}</span>
                <EstagioWhatsapp estado={wpp.estado} agora={new Date(agora)} />
                {esperandoWhatsapp && ti && (
                  <span className="flex items-start gap-1.5 text-xs text-mudo"><Hourglass size={13} className="mt-0.5 flex-none" /> Iniciar execução e registrar solução voltam quando o WhatsApp responder ou o prazo acabar. O chamado volta sozinho para o TI (e fecha sozinho se o número voltar).</span>
                )}
              </section>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 max-sm:grid-cols-1">
              <Dado rotulo="Baia">{baia ? <button type="button" className="inline-flex items-center gap-1 font-semibold text-marca-txt hover:underline" onClick={() => abrir({ baia: `${c.layoutId}:${c.pos}` })}><MapPin size={13} /> {baia}</button> : (c.local || '—')}</Dado>
              <Dado rotulo="Ocupante">{c.ocupante}</Dado>
              <Dado rotulo="Aberto por">{nomeUser(st, c.remetenteId)} · {idade(c.criadoEm, agora)}</Dado>
              <Dado rotulo="Técnico">
                {ti && !finalizado ? (
                  <select className="select min-h-[34px] w-full py-1 text-sm" value={c.tecnicoId || ''} aria-label="Encaminhar para"
                    onChange={(e) => { if (!e.target.value) return; actions.encaminhar(c.id, e.target.value); toast(e.target.value === user.id ? `Você assumiu ${numeroChamado(c.id)}.` : `Encaminhado para ${nomeUser(st, e.target.value)}. Vai aparecer para a pessoa assim que ela entrar.`); }}>
                    {!c.tecnicoId && <option value="">Ninguém ainda · encaminhar para…</option>}
                    {tecnicos.map((u) => <option key={u.id} value={u.id}>{u.id === user.id ? `${u.nome} (eu)` : u.nome}</option>)}
                  </select>
                ) : c.tecnicoId ? nomeUser(st, c.tecnicoId) : <span className="text-mudo">Ninguém ainda</span>}
              </Dado>
            </dl>

            {c.descricao && <p className="whitespace-pre-line rounded-xl bg-superficie-2 px-3.5 py-3 leading-relaxed">{c.descricao}</p>}

            {c.itens.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {c.itens.map((i, k) => {
                  const it = st.itens.find((x) => x.id === i.assetId);
                  const podeAbrir = it && tem(user, 'EST');
                  return (
                    <button key={k} type="button" disabled={!podeAbrir} onClick={() => podeAbrir && abrir({ item: it.id })}
                      className="group flex items-center gap-2.5 rounded-xl border border-linha px-3 py-2 text-left transition hover:border-marca-txt hover:bg-marca-suave-2 disabled:cursor-default disabled:hover:border-linha disabled:hover:bg-transparent">
                      <span className="tag">{it ? codigoItem(st, it) : '—'}</span>
                      <span className="min-w-0 flex-auto"><b>{nomeItem(i.tipo)}</b> <span className="text-xs text-mudo">{i.situacao}</span></span>
                      {it && <ItemBadge status={it.status} />}
                      {podeAbrir && <ExternalLink size={14} className="text-mudo group-hover:text-marca-txt" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}

            {c.solucao && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-ok-ponto/30 bg-ok-fundo/50 px-3.5 py-3">
                <span className="text-xs font-semibold text-ok">Solução · {nomeUser(st, c.solucao.user)} · {dataHora(c.solucao.at, agora)}</span>
                <p className="leading-relaxed">{c.solucao.texto}</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.solucao.causa && <span className="badge badge-sm b-info">Laudo: {c.solucao.causa}</span>}
                  {st.dossies.some((d) => d.ticketId === c.id) && <span className="badge badge-sm b-bad">Dossiê enviado ao RH</span>}
                </div>
                {podeVirarPasso && (
                  <button type="button" className="btn btn-sm mt-1 self-start" onClick={() => { actions.adicionarPasso(sit.id, c.solucao.texto); toast(`Novo passo adicionado à triagem de “${sit.nome}”.`); }}>
                    <Sparkles size={14} /> Virar passo de triagem
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {c.anexos.map((a) => <span key={a} className="badge b-blue"><Paperclip size={12} /> {a}</span>)}
              {!finalizado && (
                <label className="btn btn-sm btn-ghost cursor-pointer text-mudo">
                  <Paperclip size={13} /> Anexar
                  <input type="file" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { actions.anexar(c.id, f.name); toast(`Anexo “${f.name}” enviado.`); } }} />
                </label>
              )}
            </div>

            {outrosDaBaia.length > 0 && (
              <details className="group rounded-xl border border-linha">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-[13px] font-semibold text-tinta-2">
                  Outros chamados desta baia ({outrosDaBaia.length})
                  <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
                </summary>
                <div className="flex flex-col gap-1 px-2 pb-2">
                  {outrosDaBaia.slice(0, 6).map((x) => (
                    <button key={x.id} type="button" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-superficie-2" onClick={() => abrir({ ch: x.id })}>
                      <span className="font-semibold text-mudo">{numeroChamado(x.id)}</span>
                      <span className="min-w-0 flex-auto truncate">{x.titulo}</span>
                      <StatusBadge status={x.status} sm />
                    </button>
                  ))}
                </div>
              </details>
            )}
            {baia && itensDaBaia(st, c.layoutId, c.pos).length === 0 && <span className="text-xs text-mudo">Baia sem itens cadastrados.</span>}
          </>
        )}

        {aba === 'triagem' && (
          c.triagem.length ? (
            <ol className="flex flex-col">
              {c.triagem.map((t, k) => (
                <li key={k} className="flex items-start gap-3 border-b border-linha py-2.5 last:border-0">
                  <span className={clsx('box mt-px', t.st === 'feito' ? 'ok' : 'imp')} aria-hidden="true">{t.st === 'feito' ? '✓' : '!'}</span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span>{t.texto}</span>
                    {t.st !== 'feito' && <span className="text-xs font-semibold text-laranja">Não foi possível: {t.motivo}</span>}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-mudo">{hhmmss(t.at)}</span>
                </li>
              ))}
            </ol>
          ) : <span className="text-xs text-mudo">Este chamado não passou por triagem.</span>
        )}

        {aba === 'comentarios' && (
          <div className="flex flex-col gap-2">
            {(c.comentarios || []).map((m, k) => (
              <div key={k} className="rounded-xl bg-superficie-2 px-3.5 py-2.5">
                <div className="text-[11px] text-mudo">{nomeUser(st, m.user)} · {dataHora(m.at, agora)}</div>
                <div className="whitespace-pre-line">{m.texto}</div>
              </div>
            ))}
            {!(c.comentarios || []).length && <span className="text-xs text-mudo">Nenhum comentário ainda.</span>}
            <div className="flex items-stretch gap-2">
              <input className="input min-w-0 flex-auto" value={coment} onChange={(e) => setComent(e.target.value)} placeholder="Escreva para o TI ou para quem abriu…"
                onKeyDown={(e) => { if (e.key === 'Enter' && coment.trim()) { actions.comentar(c.id, coment.trim()); setComent(''); } }} aria-label="Novo comentário" />
              <button type="button" className="btn btn-icon" disabled={!coment.trim()} onClick={() => { actions.comentar(c.id, coment.trim()); setComent(''); }} aria-label="Enviar comentário"><MessageSquarePlus size={16} /></button>
            </div>
          </div>
        )}

        {aba === 'historico' && (
          <div className="timeline">
            {[...c.hist].reverse().map((h, k) => (
              <div key={k} className="tl-item">
                <span className="tl-dot" style={{ background: PONTO_STATUS[h.status], boxShadow: k === 0 ? '0 0 0 3px rgb(var(--superficie-3))' : 'none' }} />
                <div className="flex flex-col gap-px">
                  <span><b>{h.status}</b> <span className="text-mudo">· {nomeUser(st, h.user)}</span></span>
                  <span className="text-[11px] text-mudo">{dataHora(h.at, agora)} · {idade(h.at, agora)}</span>
                  {h.just && <span className="text-xs text-tinta-2">{h.just}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {acoes.length > 0 && (
        <footer className="sticky bottom-0 flex flex-col gap-2 border-t border-linha bg-superficie/95 px-5 py-3 backdrop-blur">
          {souDono && c.status === 'Aguardando Consenso' && <span className="text-xs text-tinta-2">O TI registrou a solução. Confira na baia e responda:</span>}
          <div className="flex flex-wrap items-center gap-2">
            {acoes.map((a) => <button key={a.l} type="button" className={`btn ${a.cls || ''}`} onClick={() => { setAba('resumo'); a.run(); }}><a.i size={15} />{a.l}</button>)}
          </div>
        </footer>
      )}
    </div>
  );
}

function Dado({ rotulo, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-mudo">{rotulo}</dt>
      <dd className="truncate text-[13.5px] font-semibold">{children}</dd>
    </div>
  );
}
