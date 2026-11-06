import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, Plus, Download, Printer, Package, Boxes, Wrench, AlertOctagon, ShieldCheck, CalendarClock, TrendingDown, Tag } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { codigoItem, localItem, nomeItem, estoquePorTipo, tem, itensDaBaia } from '../store/selectors.js';
import { STATUS_ITEM, DISPONIVEL, sugestaoCompra } from '../lib/rules.ts';
import { normalizar, dataCurta, DIA } from '../lib/format.ts';
import { posicoesDaMesa, posKey } from '../lib/labels.ts';
import { baixarCsv } from '../lib/csv.ts';
import { PageHead, Kpi, Pills, ItemBadge, Modal, Field, Note, Seg, Empty } from '../components/ui.jsx';
import { EtiquetaImpressa } from '../components/ItemDetail.jsx';

function NovoItem({ onClose }) {
  const { st, actions, toast } = useStore();
  const [f, setF] = useState({ tipo: st.tipos[0].sigla, modelo: st.tipos[0].modelos[0] || '', serie: '', fornecedor: '', compra: new Date().toISOString().slice(0, 10), garantiaMeses: 12, quantidade: 1 });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const tipo = st.tipos.find((t) => t.sigla === f.tipo);
  const ok = f.modelo.trim() && f.quantidade >= 1 && f.quantidade <= 50;
  return (
    <Modal title="Cadastrar itens no estoque" onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>Cancelar</button>
      <button type="button" className="btn btn-primary" disabled={!ok} onClick={() => {
        const ids = actions.cadastrarItens({ ...f, modelo: f.modelo.trim(), compra: new Date(f.compra).getTime(), garantiaMeses: Number(f.garantiaMeses), quantidade: Number(f.quantidade) });
        toast(`${ids.length} item(ns) cadastrado(s) no almoxarifado: ${ids[0]}${ids.length > 1 ? ` … ${ids[ids.length - 1]}` : ''}.`);
        onClose();
      }}>Cadastrar</button></>}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-3">
        <Field label="Tipo"><select className="select" value={f.tipo} onChange={(e) => { const t = st.tipos.find((x) => x.sigla === e.target.value); setF({ ...f, tipo: t.sigla, modelo: t.modelos[0] || '' }); }}>{st.tipos.map((t) => <option key={t.sigla} value={t.sigla}>{t.nome} ({t.sigla})</option>)}</select></Field>
        <Field label="Marca / modelo"><input className="input" list="modelos" value={f.modelo} onChange={set('modelo')} /><datalist id="modelos">{tipo.modelos.map((m) => <option key={m} value={m} />)}</datalist></Field>
        <Field label="Nº de série" hint="Com quantidade > 1, vira prefixo (-1, -2…)"><input className="input" value={f.serie} onChange={set('serie')} /></Field>
        <Field label="Fornecedor"><input className="input" value={f.fornecedor} onChange={set('fornecedor')} /></Field>
        <Field label="Data de compra"><input className="input" type="date" value={f.compra} onChange={set('compra')} /></Field>
        <Field label="Garantia (meses)"><input className="input" type="number" min="0" max="120" value={f.garantiaMeses} onChange={set('garantiaMeses')} /></Field>
        <Field label="Quantidade" hint="Cada unidade recebe um ID interno fixo (BEN-0000)"><input className="input" type="number" min="1" max="50" value={f.quantidade} onChange={set('quantidade')} /></Field>
      </div>
      <Note tipo="info">Os itens entram como <b>Novo</b> no almoxarifado, com etiqueta ALM-{f.tipo}-000. Ao instalar numa baia, a etiqueta muda para o código da baia.</Note>
    </Modal>
  );
}

function NovoTipo({ onClose }) {
  const { st, actions, toast } = useStore();
  const [f, setF] = useState({ sigla: '', nome: '', minimo: 2, modelos: '' });
  const sigla = f.sigla.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  const erro = sigla.length !== 2 ? 'A sigla tem 2 letras (ex.: TB para tablet).' : st.tipos.some((t) => t.sigla === sigla) ? 'Sigla já usada.' : !f.nome.trim() ? 'Informe o nome.' : '';
  return (
    <Modal title="Novo tipo de item" onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>Cancelar</button>
      <button type="button" className="btn btn-primary" disabled={!!erro} onClick={() => { actions.cadastrarTipo({ sigla, nome: f.nome.trim(), minimo: f.minimo, modelos: f.modelos.split(',').map((x) => x.trim()).filter(Boolean) }); toast(`Tipo ${f.nome} (${sigla}) criado.`); onClose(); }}>Criar tipo</button></>}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-3">
        <Field label="Sigla" hint={erro || 'Entra no fim da etiqueta: OP1-E2-' + (sigla || 'XX')} hintTone={erro ? 'bad' : ''}><input className="input uppercase" value={f.sigla} maxLength={2} onChange={(e) => setF({ ...f, sigla: e.target.value })} /></Field>
        <Field label="Nome"><input className="input" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Tablet" /></Field>
        <Field label="Estoque mínimo"><input className="input" type="number" min="0" value={f.minimo} onChange={(e) => setF({ ...f, minimo: e.target.value })} /></Field>
        <Field label="Modelos (separados por vírgula)"><input className="input" value={f.modelos} onChange={(e) => setF({ ...f, modelos: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export default function Estoque() {
  const { st, user, actions, toast, agora } = useStore();
  const { abrir } = useOutletContext();
  const [aba, setAba] = useState('itens');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Todos');
  const [tipo, setTipo] = useState('Todos');
  const [modal, setModal] = useState(null);
  const [mesaEtq, setMesaEtq] = useState(st.layouts[0].id);
  const podeEditar = tem(user, 'ASC');

  const resumo = estoquePorTipo(st);
  const cont = {};
  st.itens.forEach((i) => { cont[i.status] = (cont[i.status] || 0) + 1; });
  const pendentes = st.itens.filter((i) => i.descartePendente);
  const garantia = st.itens.filter((i) => i.status !== 'Descartado' && i.garantiaAte > agora && i.garantiaAte - agora <= 45 * DIA);
  const consumo = (sigla) => st.itens.filter((i) => i.tipo === sigla).reduce((n, i) => n + i.hist.filter((h) => h.at >= agora - 90 * DIA && /Instalad/.test(h.txt)).length, 0);
  const defeitos = useMemo(() => {
    const m = {};
    st.chamados.forEach((c) => c.itens.forEach((ci) => {
      const it = st.itens.find((x) => x.id === ci.assetId);
      if (!it || ci.instalado) return;
      m[it.modelo] ||= { modelo: it.modelo, tipo: it.tipo, chamados: 0, fabrica: 0 };
      m[it.modelo].chamados++;
      if (c.solucao?.causa === 'Defeito de fábrica') m[it.modelo].fabrica++;
    }));
    return Object.values(m).map((d) => ({ ...d, unidades: st.itens.filter((i) => i.modelo === d.modelo).length }))
      .map((d) => ({ ...d, taxa: d.chamados / Math.max(1, d.unidades) })).sort((a, b) => b.fabrica - a.fabrica || b.taxa - a.taxa).slice(0, 4);
  }, [st]);

  const lista = useMemo(() => {
    const nq = normalizar(q);
    return st.itens.filter((i) => (status === 'Todos' || i.status === status) && (tipo === 'Todos' || i.tipo === tipo)
      && (!nq || normalizar(`${codigoItem(st, i)} ${i.id} ${i.modelo} ${i.serie} ${localItem(st, i)}`).includes(nq)));
  }, [st, q, status, tipo]);

  const exportar = () => baixarCsv(`estoque-${new Date().toISOString().slice(0, 10)}`,
    ['Etiqueta', 'ID interno', 'Tipo', 'Modelo', 'Nº de série', 'Status', 'Local', 'Fornecedor', 'Compra', 'Garantia até'],
    lista.map((i) => [codigoItem(st, i), i.id, nomeItem(i.tipo), i.modelo, i.serie, i.status, localItem(st, i), i.fornecedor, dataCurta(i.compra), dataCurta(i.garantiaAte)]));

  const LE = st.layouts.find((l) => l.id === mesaEtq);

  return (
    <>
      <PageHead title="Estoque e patrimônio" desc="Itens, etiquetas, mínimos e garantias.">
        {podeEditar && <button type="button" className="btn" onClick={() => setModal('tipo')}><Tag size={15} /> Novo tipo</button>}
        {podeEditar && <button type="button" className="btn btn-primary" onClick={() => setModal('item')}><Plus size={16} /> Cadastrar itens</button>}
      </PageHead>

      <div className="grid-kpi">
        <Kpi icon={Package} label="Itens cadastrados" valor={st.itens.filter((i) => i.status !== 'Descartado').length} sub={`${cont.Descartado || 0} descartados`} />
        <Kpi icon={Boxes} label="Em uso" valor={cont['Em uso'] || 0} onClick={() => { setAba('itens'); setStatus('Em uso'); }} />
        <Kpi icon={Boxes} label="Disponíveis" valor={(cont.Novo || 0) + (cont['Disponível (usado)'] || 0)} tom="ok" title="Novos e usados no almoxarifado" onClick={() => { setAba('itens'); setStatus('Novo'); }} />
        <Kpi icon={Wrench} tom="info" label="Manutenção ou garantia" valor={(cont['Em manutenção'] || 0) + (cont['Em garantia'] || 0)} onClick={() => { setAba('itens'); setStatus('Em manutenção'); }} />
        <Kpi icon={AlertOctagon} tom="ruim" label="Quebrados" valor={cont.Quebrado || 0} onClick={() => { setAba('itens'); setStatus('Quebrado'); }} />
      </div>

      {(resumo.some((t) => t.abaixo) || pendentes.length > 0) && (
        <section className="card flex flex-col gap-1 p-2" aria-label="Precisa de atenção">
          <span className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-mudo">Precisa de atenção</span>
          {resumo.filter((t) => t.abaixo).map((t) => {
            const s = sugestaoCompra({ disponiveis: t.disponiveis, minimo: t.minimo, consumo90d: consumo(t.sigla) });
            return (
              <button key={t.sigla} type="button" className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-superficie-2" onClick={() => setAba('tipos')}
                title={`Consumo médio de ${s.mensal}/mês`}>
                <span className="grid size-8 flex-none place-items-center rounded-lg bg-aviso-fundo text-aviso-ponto"><TrendingDown size={16} /></span>
                <span className="min-w-0 flex-auto"><b>{t.nome}</b> <span className="text-mudo">abaixo do mínimo · {t.disponiveis} de {t.minimo}</span></span>
                <span className="badge b-warn">Comprar {s.sugerir}</span>
              </button>
            );
          })}
          {pendentes.map((i) => (
            <button key={i.id} type="button" className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-superficie-2" onClick={() => abrir({ item: i.id })}>
              <span className="grid size-8 flex-none place-items-center rounded-lg bg-marca-suave text-marca-txt"><ShieldCheck size={16} /></span>
              <span className="min-w-0 flex-auto"><b>Descarte de {i.id}</b> <span className="text-mudo">{tem(user, 'APROV') ? 'aguardando a sua aprovação' : 'aguardando aprovação do gestor'}</span></span>
              <span className="badge b-blue">Abrir</span>
            </button>
          ))}
        </section>
      )}

      <Seg label="Seções do estoque" value={aba} onChange={setAba} options={[{ value: 'itens', label: 'Itens' }, { value: 'tipos', label: 'Por tipo e mínimos' }, { value: 'alertas', label: 'Garantia e defeitos' }, { value: 'etiquetas', label: 'Folha de etiquetas' }]} />

      {aba === 'itens' && (
        <>
          <div className="card flex flex-col gap-3 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="search-wrap flex-[1_1_260px] max-w-[420px]">
                <Search size={16} />
                <input className="input input-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Etiqueta (OP1-E2-HS), ID (BEN-0412), modelo, série ou local" aria-label="Buscar item" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select className="select w-auto" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo"><option value="Todos">Todos os tipos</option>{st.tipos.map((t) => <option key={t.sigla} value={t.sigla}>{t.nome}</option>)}</select>
                <button type="button" className="btn" onClick={exportar}><Download size={15} /> Excel (CSV)</button>
              </div>
            </div>
            <Pills label="Status" value={status} onChange={setStatus} options={['Todos', ...STATUS_ITEM].map((s) => ({ value: s, label: s, count: s === 'Todos' ? st.itens.length : cont[s] || 0 }))} />
          </div>
          <div className="card card-pad-0 table-wrap">
            <table className="table min-w-[760px]">
              <thead><tr><th>Etiqueta</th><th>ID interno</th><th>Item</th><th>Local</th><th>Status</th><th>Garantia</th></tr></thead>
              <tbody>
                {lista.slice(0, 150).map((i) => (
                  <tr key={i.id} className="clickable" tabIndex={0} onClick={() => abrir({ item: i.id })} onKeyDown={(e) => e.key === 'Enter' && abrir({ item: i.id })}>
                    <td><span className="font-mono font-semibold text-marca-txt">{codigoItem(st, i)}</span></td>
                    <td className="font-mono text-xs">{i.id}</td>
                    <td>{nomeItem(i.tipo)}<div className="text-[11px] text-mudo">{i.modelo}</div></td>
                    <td className="text-xs">{localItem(st, i)}</td>
                    <td><ItemBadge status={i.status} />{i.descartePendente && <span className="badge badge-sm b-warn ml-1">descarte pendente</span>}</td>
                    <td className="text-xs" style={{ color: i.garantiaAte < agora ? 'rgb(var(--mudo))' : i.garantiaAte - agora < 45 * DIA ? 'rgb(var(--laranja))' : undefined }}>{dataCurta(i.garantiaAte)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lista.length === 0 && <div className="p-5"><Empty title="Nenhum item encontrado" /></div>}
            {lista.length > 150 && <div className="text-xs text-mudo p-3">Mostrando 150 de {lista.length}. Refine a busca ou exporte para ver todos.</div>}
          </div>
        </>
      )}

      {aba === 'tipos' && (
        <div className="card card-pad-0 table-wrap">
          <table className="table min-w-[700px]">
            <thead><tr><th>Tipo</th><th>Total</th><th>Em uso</th><th>Disponíveis</th><th>Mínimo</th><th>Consumo/mês</th><th>Sugestão</th></tr></thead>
            <tbody>
              {resumo.map((t) => {
                const s = sugestaoCompra({ disponiveis: t.disponiveis, minimo: t.minimo, consumo90d: consumo(t.sigla) });
                return (
                  <tr key={t.sigla}>
                    <td><b>{t.nome}</b> <span className="tag">{t.sigla}</span></td>
                    <td>{t.total}</td><td>{t.emUso}</td>
                    <td><b style={{ color: t.abaixo ? 'rgb(var(--ruim))' : 'rgb(var(--ok))' }}>{t.disponiveis}</b></td>
                    <td>{podeEditar
                      ? <input className="input w-20 min-h-[34px]" type="number" min="0" defaultValue={t.minimo} aria-label={`Mínimo de ${t.nome}`} onBlur={(e) => { const v = Number(e.target.value); if (v !== t.minimo && v >= 0) { actions.definirMinimo(t.sigla, v); toast(`Mínimo de ${t.nome}: ${v}.`); } }} />
                      : t.minimo}</td>
                    <td>{s.mensal}</td>
                    <td>{s.sugerir > 0 ? <span className="badge b-warn">Comprar {s.sugerir}</span> : <span className="badge b-ok">OK</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="text-xs text-mudo p-3">Sugestão = mínimo + consumo médio mensal (instalações nos últimos 90 dias) − disponíveis. O sistema só sugere: compras e notas fiscais ficam fora do escopo.</div>
        </div>
      )}

      {aba === 'alertas' && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-4">
          <section className="card flex flex-col gap-1.5">
            <div className="card-title"><CalendarClock size={16} /> Garantias vencendo em 45 dias</div>
            {garantia.map((i) => (
              <button key={i.id} type="button" className="ticket py-2 px-2.5 flex-row items-center" onClick={() => abrir({ item: i.id })}>
                <span className="tag">{codigoItem(st, i)}</span><span className="min-w-0 flex-auto text-xs">{nomeItem(i.tipo)} · {i.modelo}</span>
                <span className="badge badge-sm b-orange">{Math.round((i.garantiaAte - agora) / DIA)} dias</span>
              </button>
            ))}
            {!garantia.length && <span className="text-xs text-mudo">Nenhuma garantia vencendo.</span>}
          </section>
          <section className="card flex flex-col gap-1.5">
            <div className="card-title"><AlertOctagon size={16} /> Defeitos recorrentes por modelo</div>
            {defeitos.map((d) => (
              <div key={d.modelo} className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-2">
                <span><b>{d.modelo}</b><div className="text-[11px] text-mudo">{nomeItem(d.tipo)} · {d.unidades} unidades</div></span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="badge badge-sm b-blue">{d.chamados} chamados</span>
                  {d.fabrica > 0 && <span className="badge badge-sm b-bad">{d.fabrica} defeito de fábrica</span>}
                </span>
              </div>
            ))}
            <span className="text-[11px] text-mudo">Use para conversar com o fornecedor ou trocar de modelo na próxima compra.</span>
          </section>
        </div>
      )}

      {aba === 'etiquetas' && (
        <section className="card flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold">Mesa</span>
              <select className="select w-auto" value={mesaEtq} onChange={(e) => setMesaEtq(e.target.value)}>{st.layouts.map((l) => <option key={l.id} value={l.id}>{l.base} · {l.sala} {l.nome}</option>)}</select>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Imprimir folha</button>
          </div>
          <p className="text-xs text-mudo no-print">Folha pronta para etiqueta adesiva. Se o padrão de etiqueta mudar, a folha é recalculada; o histórico fica no ID interno.</p>
          <div className="labels">
            {posicoesDaMesa(LE).flatMap((p) => itensDaBaia(st, LE.id, posKey(p))).map((i) => <EtiquetaImpressa key={i.id} code={codigoItem(st, i)} item={i} empresa={st.tema.empresa} />)}
          </div>
        </section>
      )}

      {modal === 'item' && <NovoItem onClose={() => setModal(null)} />}
      {modal === 'tipo' && <NovoTipo onClose={() => setModal(null)} />}
    </>
  );
}

export { DISPONIVEL };
