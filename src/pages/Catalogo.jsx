import { useState } from 'react';
import { Plus, Trash2, ArrowUp, Upload, Users2 } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { PRIORIDADES } from '../lib/rules.ts';
import { normalizar } from '../lib/format.ts';
import { PageHead, New, Note } from '../components/ui.jsx';

let n = 0;
const nid = (p) => `${p}${Date.now().toString(36)}${n++}`;

function importarCsv(texto, catalogo) {
  const cat = structuredClone(catalogo);
  let criadas = 0;
  texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((linha, i) => {
    const [c, t, s, passos = ''] = linha.split(';').map((x) => x.trim());
    if (!c || !t || !s || (i === 0 && normalizar(c) === 'categoria')) return;
    let C = cat.find((x) => normalizar(x.nome) === normalizar(c));
    if (!C) { C = { id: nid('c'), nome: c, icone: 'app', equipe: 'TI', subs: [] }; cat.push(C); }
    let T = C.subs.find((x) => normalizar(x.nome) === normalizar(t));
    if (!T) { T = { id: nid('b'), nome: t, prio: 'Média', sla: 240, sits: [{ id: nid('s'), nome: 'Outros', passos: [], outros: true }] }; C.subs.push(T); }
    if (T.sits.some((x) => normalizar(x.nome) === normalizar(s))) return;
    T.sits.splice(T.sits.length - 1, 0, { id: nid('s'), nome: s, passos: passos.split('|').map((x) => x.trim()).filter(Boolean) });
    criadas++;
  });
  return { cat, criadas };
}

export default function Catalogo() {
  const { st, actions, toast } = useStore();
  const [ci, setCi] = useState(0);
  const [si, setSi] = useState(0);
  const [novoPasso, setNovoPasso] = useState({});
  const C = st.catalogo[ci] || st.catalogo[0];
  const S = C.subs[si] || C.subs[0];
  const editar = (fn, desc) => { const c = structuredClone(st.catalogo); fn(c, c[ci], c[ci].subs[si] || c[ci].subs[0]); actions.salvarCatalogo(c, desc); };
  const usos = (sitId) => st.chamados.filter((c) => c.sitId === sitId).length;

  const sel = (on) => ({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%', minHeight: 48, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontWeight: 600,
    background: on ? 'rgb(var(--marca))' : 'rgb(var(--superficie))', color: on ? 'rgb(var(--sobre-marca))' : 'rgb(var(--tinta))', border: `1px solid ${on ? 'rgb(var(--marca))' : 'rgb(var(--linha))'}` });

  return (
    <>
      <PageHead title="Catálogo de chamados" desc="Categoria › tipo › situação. Categorias e tipos já existem na API (com prioridade e SLA); a versão nova acrescenta as situações, com a triagem de cada uma. Tudo sem programação.">
        <label className="btn cursor-pointer"><Upload size={15} /> Importar planilha (CSV)
          <input type="file" accept=".csv,.txt" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            const { cat, criadas } = importarCsv(await f.text(), st.catalogo);
            actions.salvarCatalogo(cat, `Importação de planilha: ${criadas} situações`);
            toast(`${criadas} situação(ões) importada(s).`);
            e.target.value = '';
          }} />
        </label>
      </PageHead>
      <Note tipo="info">RF47: importe o catálogo do sistema atual com uma planilha no formato <span className="font-mono">Categoria;Tipo;Situação;Passo 1|Passo 2</span>. Linhas repetidas são ignoradas.</Note>

      <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,_minmax(260px,_1fr))]">
        <section className="card flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-3"><b>1. Categorias</b><span className="badge badge-sm b-ok">JÁ EXISTE</span></div>
          {st.catalogo.map((c, i) => (
            <button key={c.id} type="button" style={sel(i === ci)} aria-pressed={i === ci} onClick={() => { setCi(i); setSi(0); }}>
              {c.nome}<span className="text-[11px] opacity-[0.8] font-medium">{c.subs.length} tipos · atende: {c.equipe}</span>
            </button>
          ))}
          <button type="button" className="btn btn-dashed btn-sm" onClick={() => {
            const nome = prompt('Nome da nova categoria'); if (!nome?.trim()) return;
            editar((cat) => cat.push({ id: nid('c'), nome: nome.trim(), icone: 'app', equipe: 'TI', subs: [{ id: nid('b'), nome: 'Geral', prio: 'Média', sla: 240, sits: [{ id: nid('s'), nome: 'Outros', passos: [], outros: true }] }] }), `Categoria criada: ${nome}`);
          }}><Plus size={14} /> Categoria</button>
          <label className="field mt-2"><span className="flex flex-wrap items-center gap-2"><Users2 size={14} /> Equipe responsável por “{C.nome}”</span>
            <select className="select" value={C.equipe} onChange={(e) => editar((cat, c) => { c.equipe = e.target.value; }, `${C.nome}: equipe ${e.target.value}`)}>
              {['TI', 'Facilities', 'RH'].map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
        </section>

        <section className="card flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-3"><b>2. Tipos</b><span className="badge badge-sm b-ok">JÁ EXISTE</span></div>
          {C.subs.map((s, i) => (
            <button key={s.id} type="button" style={sel(i === si)} aria-pressed={i === si} onClick={() => setSi(i)}>
              {s.nome}<span className="text-[11px] opacity-[0.8] font-medium">Prioridade {s.prio} · SLA {s.sla >= 60 ? `${s.sla / 60}h` : `${s.sla} min`}{s.item ? ` · item ${s.item}` : ''}</span>
            </button>
          ))}
          <button type="button" className="btn btn-dashed btn-sm" onClick={() => {
            const nome = prompt('Nome do novo tipo'); if (!nome?.trim()) return;
            editar((cat, c) => c.subs.push({ id: nid('b'), nome: nome.trim(), prio: 'Média', sla: 240, sits: [{ id: nid('s'), nome: 'Outros', passos: [], outros: true }] }), `Tipo criado: ${nome}`);
          }}><Plus size={14} /> Tipo</button>
          <div className="grid items-start gap-2 grid-cols-[1fr_1fr] mt-2">
            <label className="field">Prioridade
              <select className="select" value={S.prio} onChange={(e) => editar((cat, c, s) => { s.prio = e.target.value; }, `${S.nome}: prioridade ${e.target.value}`)}>{PRIORIDADES.map((p) => <option key={p}>{p}</option>)}</select>
            </label>
            <label className="field">SLA (min)
              <input className="input" type="number" min="15" step="15" defaultValue={S.sla} key={S.id} onBlur={(e) => { const v = Number(e.target.value); if (v >= 15 && v !== S.sla) editar((cat, c, s) => { s.sla = v; }, `${S.nome}: SLA ${v} min`); }} />
            </label>
          </div>
        </section>

        <section className="card flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-3"><b>3. Situações e triagem</b><New /></div>
          {S.sits.map((x, i) => (
            <div key={x.id} className="card card-flat flex flex-col gap-1.5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <b>{x.nome}</b>
                <span className="text-[11px] text-mudo">{usos(x.id)} chamado(s)</span>
              </div>
              <span className="text-[11px] text-mudo">{x.outros ? 'Descrição obrigatória · vai para a fila de revisão' : x.dano ? 'Sem triagem · foto obrigatória · exige laudo' : x.solicitacao ? 'Solicitação · sem triagem' : `${x.passos.length} passo(s) obrigatório(s) antes de abrir`}</span>
              {!x.outros && (
                <div className="flex flex-wrap items-center gap-2.5">
                  <label className="check text-xs"><input type="checkbox" checked={!!x.para} onChange={(e) => editar((cat, c, s) => { s.sits[i].para = e.target.checked; }, `${x.nome}: operador parado ${e.target.checked}`)} /> Operador parado</label>
                  <label className="check text-xs"><input type="checkbox" checked={!!x.dano} onChange={(e) => editar((cat, c, s) => { s.sits[i].dano = e.target.checked; }, `${x.nome}: dano ${e.target.checked}`)} /> Dano físico</label>
                </div>
              )}
              {!x.outros && !x.dano && !x.solicitacao && (
                <div className="flex flex-col gap-1.5">
                  {x.passos.map((p, j) => (
                    <div key={j} className="flex items-center flex-nowrap gap-1.5 border-l-2 border-linha-forte pl-2">
                      <span className="text-xs min-w-0 flex-auto">{j + 1}. {p}</span>
                      {j > 0 && <button type="button" className="btn btn-sm btn-ghost btn-icon w-7 min-h-[28px]" aria-label="Subir passo" onClick={() => editar((cat, c, s) => { const a = s.sits[i].passos; [a[j - 1], a[j]] = [a[j], a[j - 1]]; }, `${x.nome}: passos reordenados`)}><ArrowUp size={13} /></button>}
                      <button type="button" className="btn btn-sm btn-ghost btn-icon w-7 min-h-[28px]" aria-label="Remover passo" onClick={() => editar((cat, c, s) => { s.sits[i].passos.splice(j, 1); }, `${x.nome}: passo removido`)}><Trash2 size={13} /></button>
                    </div>
                  ))}
                  <div className="flex items-center flex-nowrap gap-1.5">
                    <input className="input min-h-[34px]" value={novoPasso[x.id] || ''} onChange={(e) => setNovoPasso({ ...novoPasso, [x.id]: e.target.value })} placeholder="Novo passo…" aria-label={`Novo passo para ${x.nome}`}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (novoPasso[x.id] || '').trim()) { editar((cat, c, s) => { s.sits[i].passos.push(novoPasso[x.id].trim()); }, `${x.nome}: passo adicionado`); setNovoPasso({ ...novoPasso, [x.id]: '' }); } }} />
                    <button type="button" className="btn btn-sm" disabled={!(novoPasso[x.id] || '').trim()} onClick={() => { editar((cat, c, s) => { s.sits[i].passos.push(novoPasso[x.id].trim()); }, `${x.nome}: passo adicionado`); setNovoPasso({ ...novoPasso, [x.id]: '' }); }}><Plus size={13} /></button>
                  </div>
                </div>
              )}
              {!x.outros && usos(x.id) === 0 && (
                <button type="button" className="btn btn-sm btn-ghost self-start text-ruim" onClick={() => editar((cat, c, s) => { s.sits.splice(i, 1); }, `Situação removida: ${x.nome}`)}><Trash2 size={13} /> Remover situação</button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-dashed btn-sm" onClick={() => {
            const nome = prompt(`Nova situação para ${S.nome}`); if (!nome?.trim()) return;
            editar((cat, c, s) => { s.sits.splice(Math.max(0, s.sits.findIndex((y) => y.outros)), 0, { id: nid('s'), nome: nome.trim(), passos: [] }); }, `Situação criada: ${nome}`);
          }}><Plus size={14} /> Situação</button>
          <span className="text-[11px] text-mudo">“Outros” existe em todo tipo e não pode ser removido (RF44).</span>
        </section>
      </div>
    </>
  );
}
