import { useState } from 'react';
import { Minus, Plus, X, Save, Pencil, LayoutGrid } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { ITEM_NOMES, ITENS_PADRAO, PAPEIS, TOKENS, montarCodigo, posicoesDaMesa, validarMesa } from '../lib/labels.ts';
import { PageHead, Pills, Note, Field } from '../components/ui.jsx';
import DeskMap, { DeskPreview } from '../components/DeskMap.jsx';

const MODELOS = [
  { id: '8sup', label: '8 baias + supervisor', set: { esq: 4, dir: 4, centro: ['SUP'], inicio: 'sup' } },
  { id: '10ss', label: '10 baias + supervisor + sub-líder', set: { esq: 5, dir: 5, centro: ['SUP', 'SUB'], inicio: 'sup' } },
  { id: '6sem', label: '6 baias sem supervisor', set: { esq: 3, dir: 3, centro: [], inicio: 'porta' } }
];
const CENTROS = { SUP: ['SUP'], SUPSUB: ['SUP', 'SUB'], LID: ['LID'], NENHUM: [] };
const CENTRO_LABEL = { SUP: 'Supervisor', SUPSUB: 'Supervisor + sub-líder', LID: 'Líder da sala', NENHUM: 'Ninguém' };
const VAZIO = { id: null, nome: 'Equipe 6', sala: 'Operacional', base: 'OP6', supervisorId: '', esq: 4, dir: 4, centro: ['SUP'], inicio: 'sup', itens: [...ITENS_PADRAO], padrao: ['grupo', 'lado', 'posicao', 'item'], sep: '-', desativadas: {}, modelo: '8sup' };

function Stepper({ label, val, set, disabled }) {
  return (
    <div className="row-between">
      <span>{label}</span>
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className="btn btn-icon" disabled={disabled || val <= 1} onClick={() => set(val - 1)} aria-label={`Diminuir ${label.toLowerCase()}`}><Minus size={16} /></button>
        <b style={{ minWidth: 28, textAlign: 'center', fontSize: 16 }}>{val}</b>
        <button type="button" className="btn btn-icon" disabled={disabled || val >= 10} onClick={() => set(val + 1)} aria-label={`Aumentar ${label.toLowerCase()}`}><Plus size={16} /></button>
      </div>
    </div>
  );
}

export default function Espacos() {
  const { st, actions, toast } = useStore();
  const [ed, setEd] = useState(VAZIO);
  const [salvo, setSalvo] = useState(null);
  const existente = !!ed.id;
  const set = (patch) => { setEd({ ...ed, ...patch }); setSalvo(null); };
  const sigla = (ed.base || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const L = { ...ed, base: sigla, rodape: ed.inicio === 'porta' ? 'porta' : 'início da mesa' };
  const usadas = st.layouts.filter((l) => l.id !== ed.id).map((l) => l.base);
  const erro = validarMesa(L, usadas);
  const posicoes = posicoesDaMesa(L).length;
  const supervisores = st.usuarios.filter((u) => u.perfil === 'supervisor' && u.ativo);
  const centroKey = Object.keys(CENTROS).find((k) => CENTROS[k].join() === ed.centro.join()) || 'NENHUM';
  const itemEx = ed.itens.includes('HS') ? 'HS' : ed.itens[0] || 'HS';
  const exemplos = [
    [montarCodigo(L, { lado: 'E', num: 2 }), 'Baia 2 do lado esquerdo'],
    [montarCodigo(L, { lado: 'E', num: 2 }, itemEx), `${ITEM_NOMES[itemEx]} dessa baia`],
    [montarCodigo(L, { lado: 'D', num: 1 }, itemEx), `${ITEM_NOMES[itemEx]} da baia 1 do lado direito`],
    ...(L.centro.length ? [[montarCodigo(L, { papel: L.centro[0] }, 'MN'), `Monitor da mesa do ${PAPEIS[L.centro[0]].toLowerCase()}`]] : [])
  ];
  const original = existente ? st.layouts.find((l) => l.id === ed.id) : null;
  const mudaEtiqueta = original && (original.padrao.join() !== ed.padrao.join() || original.sep !== ed.sep);
  const nItensMesa = existente ? st.itens.filter((i) => i.local.kind === 'baia' && i.local.layoutId === ed.id).length : 0;

  const salvar = () => {
    const { modelo, ...resto } = ed; // eslint-disable-line no-unused-vars
    const mesa = { ...resto, base: sigla, id: ed.id || sigla, rodape: L.rodape, nome: ed.nome.trim() || `Mesa ${sigla}` };
    actions.salvarMesa(mesa);
    setSalvo(mesa.id);
    if (!existente) setEd({ ...ed, id: mesa.id });
    toast(existente ? `Mesa ${sigla} atualizada.${mudaEtiqueta ? ` ${nItensMesa} etiquetas recalculadas.` : ''}` : `Mesa ${sigla} criada com ${posicoes * ed.itens.length} itens no estoque.`);
  };

  return (
    <>
      <PageHead title="Espaços e baias" desc="Monte salas e mesas sem programação. O mapa aparece na hora para o supervisor responsável, e o padrão de etiqueta é recalculado sem perder histórico.">
        {existente && <button type="button" className="btn" onClick={() => { setEd(VAZIO); setSalvo(null); }}><Plus size={15} /> Nova mesa</button>}
      </PageHead>

      <section className="card stack-sm">
        <div className="card-title"><LayoutGrid size={16} /> Mesas cadastradas ({st.layouts.length})</div>
        <div className="row" style={{ gap: 6 }}>
          {st.layouts.map((l) => (
            <button key={l.id} type="button" className="pill" aria-pressed={ed.id === l.id} onClick={() => { setEd({ ...l, modelo: 'custom' }); setSalvo(null); }}>
              <Pencil size={12} /> {l.base} <span className="count">{posicoesDaMesa(l).length}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="split">
        <section className="side card stack-lg" style={{ flex: '1 1 400px' }}>
          <div>
            <span className="small muted">Configurações › Espaços</span>
            <h2 style={{ color: 'var(--p-ink)', marginTop: 2 }}>{existente ? `Editar mesa ${ed.base}` : 'Nova mesa'}</h2>
          </div>
          {!existente && (
            <div className="stack-sm"><b className="small" style={{ color: 'var(--p-ink)' }}>1. Comece por um modelo</b>
              <Pills label="Modelo" value={ed.modelo} onChange={(id) => { const m = MODELOS.find((x) => x.id === id); set(m ? { modelo: id, desativadas: {}, ...m.set } : { modelo: 'custom' }); }} options={[...MODELOS.map((m) => ({ value: m.id, label: m.label })), { value: 'custom', label: 'Personalizado' }]} />
            </div>
          )}
          <div className="stack-sm"><b className="small" style={{ color: 'var(--p-ink)' }}>{existente ? '1' : '2'}. Identificação</b>
            <div className="grid-2" style={{ gap: 10, gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Nome da mesa"><input className="input" value={ed.nome} onChange={(e) => set({ nome: e.target.value })} /></Field>
              <Field label="Sala"><input className="input" list="salas" value={ed.sala} onChange={(e) => set({ sala: e.target.value })} /><datalist id="salas">{[...new Set(st.layouts.map((l) => l.sala))].map((s) => <option key={s} value={s} />)}</datalist></Field>
              <Field label="Sigla do grupo" hint={existente ? 'A sigla não muda depois de criada.' : 'Entra no começo de cada etiqueta'}><input className="input" maxLength={8} value={ed.base} disabled={existente} onChange={(e) => set({ base: e.target.value.toUpperCase() })} style={{ textTransform: 'uppercase' }} /></Field>
              <Field label="Supervisor responsável"><select className="select" value={ed.supervisorId || ''} onChange={(e) => set({ supervisorId: e.target.value })}><option value="">— definir depois —</option>{supervisores.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></Field>
            </div>
          </div>
          <div className="stack-sm"><b className="small" style={{ color: 'var(--p-ink)' }}>{existente ? '2' : '3'}. Formato da mesa</b>
            {existente && <span className="tiny muted">Em mesas já em uso, a quantidade de baias não muda (os itens estão vinculados). Desative baias clicando na prévia.</span>}
            <Stepper label="Baias do lado esquerdo" val={ed.esq} set={(v) => set({ esq: v, modelo: 'custom' })} disabled={existente} />
            <Stepper label="Baias do lado direito" val={ed.dir} set={(v) => set({ dir: v, modelo: 'custom' })} disabled={existente} />
            {!existente && <>
              <span className="small">Quem fica no centro da mesa</span>
              <Pills label="Centro" value={centroKey} onChange={(k) => set({ centro: CENTROS[k], modelo: 'custom' })} options={Object.keys(CENTROS).map((k) => ({ value: k, label: CENTRO_LABEL[k] }))} />
              <span className="small">A baia 1 começa</span>
              <Pills label="Início" value={ed.inicio} onChange={(v) => set({ inicio: v, modelo: 'custom' })} options={[{ value: 'sup', label: 'Pelo lado do supervisor' }, { value: 'porta', label: 'Pela porta' }]} />
              <span className="small">Itens padrão em cada baia</span>
              <div className="row" style={{ gap: 6 }}>{st.tipos.map((t) => {
                const on = ed.itens.includes(t.sigla);
                return <button key={t.sigla} type="button" className="pill" aria-pressed={on} onClick={() => set({ itens: on ? ed.itens.filter((x) => x !== t.sigla) : [...ed.itens, t.sigla] })}>{on ? '✓ ' : ''}{t.nome}</button>;
              })}</div>
            </>}
          </div>
          <div className="stack-sm"><b className="small" style={{ color: 'var(--p-ink)' }}>{existente ? '3' : '4'}. Padrão de etiqueta</b>
            <span className="tiny muted">Os campos entram na ordem em que aparecem. Remova e adicione para reordenar.</span>
            <div className="row" style={{ gap: 6, background: 'var(--surface-2)', borderRadius: 10, padding: 6, minHeight: 46 }}>
              {ed.padrao.map((k, i) => (
                <span key={k} className="row" style={{ gap: 4, background: 'var(--p)', color: 'var(--on-p)', borderRadius: 999, padding: '0 4px 0 12px', minHeight: 34, fontWeight: 600, fontSize: 13 }}>
                  <span className="tiny" style={{ opacity: 0.8 }}>{i + 1}.</span>{TOKENS[k]}
                  <button type="button" className="btn btn-ghost btn-icon" style={{ width: 26, minHeight: 26, color: 'inherit' }} onClick={() => set({ padrao: ed.padrao.filter((x) => x !== k) })} aria-label={`Remover o campo ${TOKENS[k]}`}><X size={14} /></button>
                </span>
              ))}
            </div>
            <div className="row" style={{ gap: 6 }}>
              {Object.keys(TOKENS).filter((k) => !ed.padrao.includes(k)).map((k) => <button key={k} type="button" className="pill btn-dashed" onClick={() => set({ padrao: [...ed.padrao, k] })}>+ {TOKENS[k]}</button>)}
            </div>
            <Pills label="Separador" value={ed.sep} onChange={(v) => set({ sep: v })} options={[{ value: '-', label: 'Hífen ( - )' }, { value: '.', label: 'Ponto ( . )' }, { value: '', label: 'Sem separador' }]} />
            <div className="card card-flat stack-sm" style={{ padding: 12 }}>
              <span className="small bold muted">Prévia</span>
              {exemplos.map(([c, d]) => <div key={d} className="row"><span className="tag">{c}</span><span className="small">{d}</span></div>)}
              {!ed.padrao.includes('lado') && <span className="tiny muted">Sem o campo Lado, as baias são numeradas em sequência: primeiro o lado esquerdo, depois o direito.</span>}
            </div>
            {mudaEtiqueta && <Note tipo="warn">Ao salvar, as {nItensMesa} etiquetas desta mesa serão recalculadas e uma folha nova fica disponível no estoque. O histórico não se perde: ele está preso ao ID interno de cada item (RN12).</Note>}
          </div>
        </section>

        <section className="main card stack">
          <div>
            <h2 style={{ color: 'var(--p-ink)' }}>Prévia do mapa: {ed.nome}</h2>
            <p className="small muted" style={{ marginTop: 4 }}>É assim que o supervisor vai ver. Clique numa baia para desativar ou reativar.</p>
          </div>
          <DeskPreview layout={L} onToggle={(k) => { const d = { ...ed.desativadas }; if (d[k]) delete d[k]; else d[k] = true; set({ desativadas: d, modelo: 'custom' }); }} />
          <span className="small">{posicoes} posições{!existente ? ` · ${posicoes * ed.itens.length} itens serão criados no estoque` : ''}</span>
          {erro && <Note tipo="bad">{erro}</Note>}
          {salvo && (
            <div className="note note-ok row-between" style={{ alignItems: 'center' }}>
              <span><b>Mesa {sigla} salva.</b> Já aparece para: {st.usuarios.find((u) => u.id === ed.supervisorId)?.nome || 'o TI (defina um supervisor)'}.</span>
            </div>
          )}
          <button type="button" className="btn btn-primary btn-lg" disabled={!!erro} onClick={salvar}><Save size={16} /> {erro ? 'Corrija o item acima para salvar' : existente ? 'Salvar alterações' : 'Salvar mesa'}</button>
          {salvo && st.layouts.find((l) => l.id === salvo) && (
            <div className="stack-sm">
              <span className="small bold muted">Mapa real (com ocupação e chamados)</span>
              <DeskMap layout={st.layouts.find((l) => l.id === salvo)} compact />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
