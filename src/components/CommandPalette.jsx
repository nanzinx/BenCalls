import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Ticket, Package, LayoutGrid, CornerDownLeft, ArrowRight } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { chamadosVisiveis, codigoItem, layoutsDoUsuario, nomeItem, tem, baiaCodigo } from '../store/selectors.js';
import { numeroChamado, normalizar } from '../lib/format.ts';
import { posicoesDaMesa, posKey } from '../lib/labels.ts';
import { StatusBadge, ItemBadge } from './ui.jsx';

/** Busca global (Ctrl+K): chamado pelo número, item pela etiqueta ou ID interno, baia pelo código, telas. */
export default function CommandPalette({ onClose, menu, abrir }) {
  const { st, user } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const listRef = useRef(null);

  const grupos = useMemo(() => {
    const nq = normalizar(q.trim());
    const out = [];
    const telas = menu.filter((m) => !nq || normalizar(m.label).includes(nq)).slice(0, nq ? 4 : 8)
      .map((m) => ({ key: `p${m.to}`, icon: ArrowRight, titulo: m.label, sub: 'Ir para a tela', run: () => nav(m.to) }));
    if (telas.length) out.push({ nome: 'Telas', itens: telas });
    if (!nq) return out;

    const chs = chamadosVisiveis(st, user).filter((c) => {
      const alvo = normalizar(`${numeroChamado(c.id)} ${c.id} ${c.titulo} ${c.layoutId ? baiaCodigo(st, c.layoutId, c.pos) : ''} ${c.ocupante}`);
      return alvo.includes(nq.replace('#', ''));
    }).sort((a, b) => b.criadoEm - a.criadoEm).slice(0, 6)
      .map((c) => ({ key: `c${c.id}`, icon: Ticket, titulo: `${numeroChamado(c.id)} · ${c.titulo}`, sub: c.layoutId ? baiaCodigo(st, c.layoutId, c.pos) : c.local || 'Sem baia', extra: <StatusBadge status={c.status} sm />, run: () => abrir({ ch: c.id }) }));
    if (chs.length) out.push({ nome: 'Chamados', itens: chs });

    const layouts = layoutsDoUsuario(st, user);
    const baias = [];
    for (const L of layouts) for (const p of posicoesDaMesa(L)) {
      const cod = baiaCodigo(st, L.id, posKey(p));
      const oc = st.ocupacao[`${L.id}:${posKey(p)}`]?.nome || '';
      if (normalizar(`${cod} ${oc}`).includes(nq)) baias.push({ key: `b${cod}`, icon: LayoutGrid, titulo: `Baia ${cod}`, sub: `${L.sala} · ${L.nome}${oc ? ` · ${oc}` : ' · vazia'}`, run: () => abrir({ baia: `${L.id}:${posKey(p)}` }) });
    }
    if (baias.length) out.push({ nome: 'Baias', itens: baias.slice(0, 5) });

    if (tem(user, 'EST') || tem(user, 'RC')) {
      const its = st.itens.filter((it) => normalizar(`${codigoItem(st, it)} ${it.id} ${it.modelo} ${it.serie}`).includes(nq)).slice(0, 6)
        .map((it) => ({ key: `i${it.id}`, icon: Package, titulo: `${codigoItem(st, it)} · ${nomeItem(it.tipo)}`, sub: `${it.id} · ${it.modelo}`, extra: <ItemBadge status={it.status} />, run: () => abrir({ item: it.id }) }));
      if (its.length) out.push({ nome: 'Itens do estoque', itens: its });
    }
    return out;
  }, [q, st, user, menu, nav, abrir]);

  const planos = grupos.flatMap((g) => g.itens);
  useEffect(() => { setI(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [i]);

  const exec = (it) => { it.run(); onClose(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(planos.length - 1, x + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
    if (e.key === 'Enter' && planos[i]) { e.preventDefault(); exec(planos[i]); }
    if (e.key === 'Escape') onClose();
  };

  let k = -1;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Busca global">
        <div className="relative">
          <Search className="absolute left-[18px] top-5 text-mudo" size={18} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Busque chamado (#2026-0131), etiqueta (OP1-E2-HS), ID (BEN-0412), baia ou tela…"
            aria-label="Buscar" role="combobox" aria-expanded="true" aria-controls="palette-list" />
        </div>
        <div className="p-list" id="palette-list" role="listbox" ref={listRef}>
          {grupos.map((g) => (
            <div key={g.nome}>
              <div className="p-group">{g.nome}</div>
              {g.itens.map((it) => {
                k++;
                const sel = k === i;
                const idx = k;
                return (
                  <button key={it.key} type="button" role="option" aria-selected={sel} className="p-item" onMouseEnter={() => setI(idx)} onClick={() => exec(it)}>
                    <it.icon className="text-marca-txt flex-none" size={17} />
                    <span className="min-w-0 flex-auto flex flex-col">
                      <span className="font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{it.titulo}</span>
                      <span className="p-sub">{it.sub}</span>
                    </span>
                    {it.extra}
                    {sel && <CornerDownLeft className="text-mudo" size={14} />}
                  </button>
                );
              })}
            </div>
          ))}
          {q && !planos.length && <div className="empty border-0">Nada encontrado para “{q}”.</div>}
        </div>
      </div>
    </div>
  );
}
