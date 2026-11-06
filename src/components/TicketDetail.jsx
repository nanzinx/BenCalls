import { useMemo, useState } from 'react';
import { X, Paperclip, AlertTriangle, ListChecks, Wrench, UserCheck, Play, PauseCircle, Ban, ThumbsUp, ThumbsDown, RotateCcw, MessageSquarePlus, ArrowRightLeft, Sparkles, MapPin, ExternalLink } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { baiaCodigo, codigoItem, indiceCatalogo, nomeItem, nomeUser, tem, itensDaBaia } from '../store/selectors.js';
import { numeroChamado, hhmmss, dataHora, idade } from '../lib/format.ts';
import { CAUSAS, podeReabrir, DISPONIVEL } from '../lib/rules.ts';
import { StatusBadge, PrioBadge, Sla, Note, PONTO_STATUS, ItemBadge, AjudaSla } from './ui.jsx';

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
          <span className="text-xs font-semibold">Laudo técnico: qual foi a causa? <span className="text-mudo">(obrigatório — RN02)</span></span>
          <div className="flex flex-wrap items-center gap-1.5">
            {CAUSAS.map((k) => (
              <button key={k} type="button" className="pill" aria-pressed={causa === k} onClick={() => setCausa(k)}
                style={causa === k && k === 'Mau uso' ? { background: 'rgb(var(--ruim-ponto))', borderColor: 'rgb(var(--ruim-ponto))' } : undefined}>{k}</button>
            ))}
          </div>
          {causa === 'Mau uso' && (
            <Note tipo="bad">Gera um dossiê para o RH com chamado, laudo, fotos, ocupante e termo assinado. <b>O sistema nunca aplica desconto</b>: a decisão é do RH (RN03).</Note>
          )}
        </div>
      )}
      {itensChamado.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold flex flex-wrap items-center gap-2"><ArrowRightLeft size={14} /> Troca de item (baixa automática no estoque — RF16)</span>
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
  const { st, user, actions, toast, agora } = useStore();
  const c = st.chamados.find((x) => x.id === id);
  const [form, setForm] = useState(null);
  const [txt, setTxt] = useState('');
  const [coment, setComent] = useState('');
  const { sits } = useMemo(() => indiceCatalogo(st), [st]);
  if (!c) return null;

  const souDono = c.remetenteId === user.id;
  const ti = tem(user, 'ASC');
  const F = form && FORMS[form];
  const baia = c.layoutId ? baiaCodigo(st, c.layoutId, c.pos) : null;
  const sit = sits[c.sitId];
  const acoes = [];
  if (!form) {
    if (ti && !c.tecnicoId && ['Em Análise', 'Pendente'].includes(c.status)) acoes.push({ l: 'Assumir', i: UserCheck, run: () => { actions.assumir(c.id); toast(`Você assumiu ${numeroChamado(c.id)}.`); } });
    if (ti && ['Em Análise', 'Pendente'].includes(c.status)) acoes.push({ l: 'Iniciar execução', i: Play, cls: 'btn-primary', run: () => { actions.iniciarExecucao(c.id); toast(`${numeroChamado(c.id)} em execução.`); } });
    if (ti && ['Em Análise', 'Em Execução'].includes(c.status)) acoes.push({ l: 'Marcar como pendente', i: PauseCircle, run: () => setForm('pendente') });
    if (ti && c.status === 'Em Execução') acoes.push({ l: 'Registrar solução', i: Wrench, cls: 'btn-primary', run: () => setForm('solucao') });
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

  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap justify-between gap-3 items-start">
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <span className="text-xs font-semibold text-mudo">{numeroChamado(c.id)} · {c.categoria} › {c.sub}</span>
          <h2 className="text-[19px] text-marca-txt">{c.titulo}</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={c.status} />
            <PrioBadge prio={c.prioridade} sm={false} />
            {c.operadorParado && !['Concluído', 'Cancelado', 'Negado'].includes(c.status) && <span className="badge b-bad">Operador parado</span>}
            {c.reaberturas > 0 && <span className="badge b-orange">Reaberto {c.reaberturas}×</span>}
          </div>
        </div>
        <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Fechar detalhe"><X size={18} /></button>
      </div>

      <div className="flex gap-2 items-start flex-nowrap"><div className="min-w-0 flex-auto"><Sla ch={c} agora={agora} bar /></div><AjudaSla /></div>

      <div className="detail-grid">
        <div><div className="lbl">Baia</div><div className="val">{baia ? <button type="button" className="btn btn-sm btn-ghost p-0 min-h-0" onClick={() => abrir({ baia: `${c.layoutId}:${c.pos}` })}><MapPin size={13} /> {baia}</button> : '—'}</div></div>
        <div><div className="lbl">Ocupante na abertura</div><div className="val">{c.ocupante}</div></div>
        <div><div className="lbl">Aberto por</div><div className="val">{nomeUser(st, c.remetenteId)}</div></div>
        <div><div className="lbl">Aberto em</div><div className="val">{dataHora(c.criadoEm, agora)} · {idade(c.criadoEm, agora)}</div></div>
        <div><div className="lbl">Atendimento</div><div className="val">{c.depto} · {c.tecnicoId ? nomeUser(st, c.tecnicoId) : <span className="text-mudo">sem técnico</span>}</div></div>
        <div><div className="lbl">SLA da prioridade (prazo)</div><div className="val">{c.slaMin >= 60 ? `${c.slaMin / 60}h` : `${c.slaMin} min`}</div></div>
        {c.local && <div className="col-span-full"><div className="lbl">Onde</div><div className="val">{c.local}</div></div>}
      </div>

      {c.alerta && <Note tipo="bad"><b>Alerta de triagem:</b> {c.alerta}</Note>}
      {c.outros && !c.outrosRevisado && <Note tipo="gray"><b>“Outros”:</b> está na fila de revisão do TI para ser reclassificado.</Note>}

      {c.itens.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-mudo">Itens</span>
          {c.itens.map((i, k) => {
            const it = st.itens.find((x) => x.id === i.assetId);
            return (
              <div key={k} className="flex flex-wrap items-center gap-2 border border-linha rounded-[10px] py-2 px-2.5">
                <span className="tag">{it ? codigoItem(st, it) : '—'}</span>
                <b>{nomeItem(i.tipo)}</b>
                <span className="text-xs text-mudo min-w-0 flex-auto">{i.situacao}</span>
                {it && <ItemBadge status={it.status} />}
                {it && tem(user, 'EST') && <button type="button" className="btn btn-sm btn-ghost" onClick={() => abrir({ item: it.id })} aria-label={`Abrir item ${it.id}`}><ExternalLink size={13} /> {it.id}</button>}
              </div>
            );
          })}
        </div>
      )}

      {c.descricao && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-mudo">Descrição</span>
          <p className="whitespace-pre-line leading-[1.55]">{c.descricao}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {c.anexos.map((a) => <span key={a} className="badge b-blue"><Paperclip size={12} /> {a}</span>)}
        {!['Concluído', 'Cancelado', 'Negado'].includes(c.status) && (
          <label className="btn btn-sm btn-dashed cursor-pointer">
            <Paperclip size={13} /> Anexar arquivo
            <input type="file" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { actions.anexar(c.id, f.name); toast(`Anexo “${f.name}” enviado (BenTabularium).`); } }} />
          </label>
        )}
      </div>

      {c.triagem.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-mudo flex flex-wrap items-center gap-2"><ListChecks size={14} /> Registro da triagem</span>
          {c.triagem.map((t, k) => (
            <div key={k} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-linha pb-1.5">
              <span className="font-mono text-[11px] text-mudo">{hhmmss(t.at)}</span>
              <span className="flex-[1_1_200px]">{t.texto}</span>
              <span className="text-xs font-semibold" style={{ color: t.st === 'feito' ? 'rgb(var(--ok))' : 'rgb(var(--laranja))' }}>{t.st === 'feito' ? 'Feito' : `Não foi possível: ${t.motivo}`}</span>
            </div>
          ))}
        </div>
      )}

      {c.solucao && (
        <div className="card card-flat flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-mudo">Solução · {nomeUser(st, c.solucao.user)} · {dataHora(c.solucao.at, agora)}</span>
          <p className="leading-[1.55]">{c.solucao.texto}</p>
          {c.solucao.causa && <span className="text-xs font-semibold text-info">Laudo técnico: {c.solucao.causa}</span>}
          {st.dossies.some((d) => d.ticketId === c.id) && <span className="text-xs font-semibold text-ruim">Dossiê enviado ao RH para análise do termo de responsabilidade.</span>}
          {podeVirarPasso && (
            <button type="button" className="btn btn-sm self-start" onClick={() => { actions.adicionarPasso(sit.id, c.solucao.texto); toast(`Novo passo adicionado à triagem de “${sit.nome}”.`); }}>
              <Sparkles size={14} /> Transformar em passo de triagem (RF08)
            </button>
          )}
        </div>
      )}

      {souDono && c.status === 'Aguardando Consenso' && !form && (
        <Note tipo="warn">Confira na baia se o problema foi resolvido. Sua resposta encerra o chamado ou devolve ao TI.</Note>
      )}

      {acoes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {acoes.map((a) => <button key={a.l} type="button" className={`btn ${a.cls || ''}`} onClick={a.run}><a.i size={15} />{a.l}</button>)}
        </div>
      )}

      {form === 'solucao' && <SolucaoForm c={c} onCancel={() => setForm(null)} onDone={(m) => { setForm(null); toast(m); }} />}
      {F && (
        <div className="card card-flat flex flex-col gap-1.5 bg-superficie-2">
          <label className="field">{F.titulo}
            <textarea className="textarea" rows={3} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={F.ph} autoFocus />
          </label>
          {form === 'devolver' && <span className="text-xs text-mudo">Volta para “Em Execução” com o seu comentário no histórico.</span>}
          {form === 'reabrir' && <span className="text-xs text-mudo">Reabertura em até 7 dias volta para o mesmo técnico e conta como reabertura nos relatórios (RN07).</span>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`btn ${form === 'negar' || form === 'cancelar' ? 'btn-danger' : 'btn-primary'}`} disabled={txt.trim().length < 5} onClick={confirmar}>{F.botao}</button>
            <button type="button" className="btn" onClick={() => { setForm(null); setTxt(''); }}>Voltar</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-mudo">Comentários</span>
        {(c.comentarios || []).map((m, k) => (
          <div key={k} className="card card-flat p-2.5">
            <div className="text-[11px] text-mudo">{nomeUser(st, m.user)} · {dataHora(m.at, agora)}</div>
            <div className="whitespace-pre-line">{m.texto}</div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 items-stretch">
          <input className="input min-w-0 flex-auto" value={coment} onChange={(e) => setComent(e.target.value)} placeholder="Escreva um comentário para o TI ou para quem abriu…"
            onKeyDown={(e) => { if (e.key === 'Enter' && coment.trim()) { actions.comentar(c.id, coment.trim()); setComent(''); } }} aria-label="Novo comentário" />
          <button type="button" className="btn" disabled={!coment.trim()} onClick={() => { actions.comentar(c.id, coment.trim()); setComent(''); }}><MessageSquarePlus size={15} /> Enviar</button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-mudo">Histórico</span>
        <div className="timeline">
          {[...c.hist].reverse().map((h, k) => (
            <div key={k} className="tl-item">
              <span className="tl-dot" style={{ background: PONTO_STATUS[h.status], boxShadow: k === 0 ? `0 0 0 3px rgb(var(--superficie-3))` : 'none' }} />
              <div className="flex flex-col gap-px">
                <span><b>{h.status}</b> <span className="text-mudo">· {nomeUser(st, h.user)}</span></span>
                <span className="text-[11px] text-mudo">{dataHora(h.at, agora)} · {idade(h.at, agora)}</span>
                {h.just && <span className="text-xs text-tinta-2">{h.just}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {baia && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-mudo flex flex-wrap items-center gap-2"><AlertTriangle size={14} /> Outros chamados desta baia</span>
          {st.chamados.filter((x) => x.layoutId === c.layoutId && x.pos === c.pos && x.id !== c.id).sort((a, b) => b.criadoEm - a.criadoEm).slice(0, 5).map((x) => (
            <button key={x.id} type="button" className="ticket py-2 px-2.5" onClick={() => abrir({ ch: x.id })}>
              <span className="t-top"><span className="t-num">{numeroChamado(x.id)} · {idade(x.criadoEm, agora)}</span><StatusBadge status={x.status} sm /></span>
              <span className="text-xs">{x.titulo}</span>
            </button>
          ))}
          {!st.chamados.some((x) => x.layoutId === c.layoutId && x.pos === c.pos && x.id !== c.id) && <span className="text-xs text-mudo">Nenhum outro chamado nesta baia.</span>}
          {itensDaBaia(st, c.layoutId, c.pos).length === 0 && <span className="text-xs text-mudo">Baia sem itens cadastrados.</span>}
        </div>
      )}
    </div>
  );
}
