import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Inbox, PlusCircle, KanbanSquare, Map, Package, ClipboardCheck, ShieldAlert, BarChart3, Users, ListTree,
  LayoutGrid, Palette, ScrollText, Search, Bell, Menu, LogOut, Moon, Sun, RotateCcw, MessageSquare, FileSignature, X
} from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { tem, estoquePorTipo, layoutsDoUsuario } from '../store/selectors.js';
import { iniciais, idade } from '../lib/format.ts';
import { Assinatura } from './ui.jsx';
import { Logo, useModo } from './Theme.jsx';
import { NomeMarca } from './Marca.tsx';
import CommandPalette from './CommandPalette.jsx';
import TicketDetail from './TicketDetail.jsx';
import ItemDetail from './ItemDetail.jsx';
import BaiaDetail from './BaiaDetail.jsx';
import { Drawer } from './ui.jsx';
import { Entrada } from './Entrada.tsx';
import { deveMostrarEntrada, diaDe, lerVistoEm, loginRecente, limparLogin, marcarVisto, marcarAtividade, inativo } from '../lib/entrada.ts';
import { slaInfo, ABERTOS } from '../lib/rules.ts';

/** Números que aparecem na entrada, conforme o perfil. */
function selosDaEntrada(st, user, agora) {
  const abertos = st.chamados.filter((c) => ABERTOS.includes(c.status));
  if (user.perfil === 'supervisor') {
    const eq = new Set(user.equipes || []);
    const meus = abertos.filter((c) => eq.has(c.layoutId) || c.remetenteId === user.id);
    const confirmar = meus.filter((c) => c.status === 'Aguardando Consenso' && c.remetenteId === user.id).length;
    const parados = meus.filter((c) => c.operadorParado && c.status !== 'Aguardando Consenso').length;
    return [
      { valor: meus.length, texto: meus.length === 1 ? 'chamado em aberto' : 'chamados em aberto' },
      { valor: confirmar, texto: 'aguardando sua confirmação', tom: confirmar ? 'alerta' : 'ok' },
      { valor: parados, texto: parados === 1 ? 'operador parado' : 'operadores parados', tom: parados ? 'alerta' : 'ok' }
    ];
  }
  if (user.perfil === 'rh') {
    const d = st.dossies.filter((x) => x.status === 'Aguardando RH').length;
    const t = Object.values(st.termos).filter((x) => !x.assinadoEm).length;
    return [{ valor: d, texto: 'dossiês para analisar', tom: d ? 'alerta' : 'ok' }, { valor: t, texto: 'termos aguardando aceite' }];
  }
  const risco = abertos.filter((c) => { const i = slaInfo(c, agora); return !i.pausado && i.nivel !== 'ok'; }).length;
  const analise = abertos.filter((c) => c.status === 'Em Análise').length;
  const sel = [
    { valor: analise, texto: 'em análise' },
    { valor: abertos.length, texto: 'em andamento' },
    { valor: risco, texto: 'com SLA em risco', tom: risco ? 'alerta' : 'ok' }
  ];
  if (user.perfil === 'ti') sel.push({ valor: abertos.filter((c) => c.alerta).length, texto: 'alertas de triagem' });
  return sel;
}

export function useMenu() {
  const { st, user } = useStore();
  return useMemo(() => {
    if (!user) return [];
    const emAnalise = st.chamados.filter((c) => c.status === 'Em Análise').length;
    const aguardando = st.chamados.filter((c) => c.remetenteId === user.id && c.status === 'Aguardando Consenso').length;
    const outros = st.chamados.filter((c) => c.outros && !c.outrosRevisado).length;
    const dossies = st.dossies.filter((d) => d.status === 'Aguardando RH').length;
    const alertasEst = estoquePorTipo(st).filter((t) => t.abaixo).length + st.itens.filter((i) => i.descartePendente).length;
    const minhas = new Set(layoutsDoUsuario(st, user).map((l) => l.id));
    const termosPend = Object.entries(st.termos).filter(([k, t]) => !t.assinadoEm && minhas.has(k.split(':')[0])).length;
    const itens = [
      { to: '/inicio', label: 'Meus chamados', icon: Inbox, a: 'DACP', badge: aguardando, warn: true },
      { to: '/novo', label: 'Novo chamado', icon: PlusCircle, a: 'RC' },
      { to: '/painel', label: 'Painel de chamados', icon: KanbanSquare, a: 'PC', badge: emAnalise },
      { to: '/mapa', label: 'Mapa geral', icon: Map, a: 'MAPA' },
      { to: '/revisao', label: 'Revisão de "Outros"', icon: ClipboardCheck, a: 'REV', badge: outros, warn: true },
      { to: '/estoque', label: 'Estoque e patrimônio', icon: Package, a: 'EST', badge: alertasEst, warn: true },
      { to: '/termos', label: 'Termos de responsabilidade', icon: FileSignature, a: 'TERMO', mod: 'termo', badge: termosPend },
      { to: '/rh', label: 'Dossiês do RH', icon: ShieldAlert, a: 'RH', mod: 'dossie', badge: dossies, warn: true },
      { to: '/relatorios', label: 'Dashboard e relatórios', icon: BarChart3, a: 'DVGC' },
      { secao: 'Gestão' },
      { to: '/usuarios', label: 'Usuários', icon: Users, a: 'CU' },
      { to: '/catalogo', label: 'Catálogo de chamados', icon: ListTree, a: 'RCSC' },
      { to: '/espacos', label: 'Espaços e baias', icon: LayoutGrid, a: 'ESP' },
      { to: '/personalizacao', label: 'Personalização', icon: Palette, a: 'TEMA' },
      { to: '/auditoria', label: 'Auditoria', icon: ScrollText, a: 'AUD' }
    ];
    const vis = itens.filter((m) => m.secao || (tem(user, m.a) && (!m.mod || st.modulos[m.mod])));
    return vis.filter((m, i) => !m.secao || (vis[i + 1] && !vis[i + 1].secao));
  }, [st, user]);
}

export function rotaInicial(user) {
  return { supervisor: '/inicio', ti: '/painel', rh: '/rh', gestor: '/relatorios' }[user?.perfil] || '/inicio';
}

function Notificacoes({ onClose }) {
  const { st, actions } = useStore();
  const ref = useRef(null);
  useEffect(() => {
    const f = (e) => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest('[data-notif-btn]')) onClose(); };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, [onClose]);
  return (
    <div className="popover" ref={ref} role="dialog" aria-label="Notificações">
      <div className="flex flex-wrap items-center justify-between gap-3 py-3 px-3.5">
        <div>
          <b>Notificações</b>
          <div className="text-[11px] text-mudo">Cópia do que foi enviado aos grupos do {st.modulos.benhub ? 'BenHub' : 'e-mail'}</div>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={actions.marcarLidas}>Marcar todas como lidas</button>
      </div>
      <div className="max-h-[420px] overflow-auto">
        {st.notificacoes.slice(0, 30).map((n) => (
          <div key={n.id} className={`notif${n.lida ? '' : ' unread'}`}>
            <span className="n-ic"><MessageSquare size={15} /></span>
            <div className="min-w-0 flex-auto">
              <div>{n.texto}</div>
              <div className="text-[11px] text-mudo mt-[3px]">{n.canal} · grupo <b>{n.grupo}</b> · {idade(n.at)}</div>
            </div>
          </div>
        ))}
        {!st.notificacoes.length && <div className="notif text-mudo">Nenhuma notificação.</div>}
      </div>
    </div>
  );
}

const OCUPACOES = ['Disponível', 'Em atendimento', 'Almoço', 'Inoperante'];

export default function Layout() {
  const { st, user, actions, toasts, fecharToast } = useStore();
  const menu = useMenu();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState(false);
  const [notif, setNotif] = useState(false);
  const [modo, setModo] = useModo();
  const [ocup, setOcup] = useState(() => localStorage.getItem('bencalls:ocupacao') || 'Disponível');
  const [sp, setSp] = useSearchParams();
  const loc = useLocation();
  const nav = useNavigate();
  const [entrada, setEntrada] = useState(() => deveMostrarEntrada({ vistoEm: lerVistoEm(), hoje: diaDe(new Date()), acabouDeEntrar: loginRecente() }));
  const [cascataEntrada, setCascataEntrada] = useState(false);
  const selos = useMemo(() => selosDaEntrada(st, user, Date.now()), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sessão expira após 30 min sem uso (como no BenHeimdall).
  useEffect(() => {
    marcarAtividade();
    let ultimo = 0;
    const mexeu = () => { const t = Date.now(); if (t - ultimo > 15_000) { ultimo = t; marcarAtividade(t); } };
    const eventos = ['pointerdown', 'keydown', 'scroll', 'pointermove'];
    eventos.forEach((e) => window.addEventListener(e, mexeu, { passive: true }));
    const id = setInterval(() => {
      if (inativo()) { sessionStorage.setItem('bencalls-aviso', 'Sua sessão expirou por inatividade. Entre de novo.'); actions.logout(); nav('/login'); }
    }, 30_000);
    return () => { eventos.forEach((e) => window.removeEventListener(e, mexeu)); clearInterval(id); };
  }, [actions, nav]);

  // Brilho que segue o mouse nos cartões (KPIs e cartões com .brilho).
  useEffect(() => {
    const f = (e) => {
      const el = e.target.closest?.('.kpi, .card.brilho');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    document.addEventListener('pointermove', f, { passive: true });
    return () => document.removeEventListener('pointermove', f);
  }, []);

  useEffect(() => { setAberto(false); }, [loc.pathname]);
  useEffect(() => {
    const f = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setBusca(true); }
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) { e.preventDefault(); setBusca(true); }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  const abrir = useCallback((obj) => {
    const n = new URLSearchParams(sp);
    ['ch', 'item', 'baia'].forEach((k) => n.delete(k));
    for (const [k, v] of Object.entries(obj)) if (v !== null && v !== undefined) n.set(k, String(v));
    setSp(n);
  }, [sp, setSp]);
  const fechar = (k) => { const n = new URLSearchParams(sp); n.delete(k); setSp(n); };

  const naoLidas = st.notificacoes.filter((n) => !n.lida).length;
  const chId = sp.get('ch') ? Number(sp.get('ch')) : null;
  const itemId = sp.get('item');
  const baiaKey = sp.get('baia');

  return (
    <div className="shell">
      <a href="#conteudo" className="sr-only">Pular para o conteúdo</a>
      <header className="topbar">
        <button type="button" className="tb-btn menu-toggle" aria-label="Abrir menu" aria-expanded={aberto} onClick={() => setAberto((x) => !x)}>
          {aberto ? <X size={18} /> : <Menu size={18} />}
        </button>
        <NavLink to={rotaInicial(user)} className="brand">
          <Logo tema={st.tema} />
          <span className="brand-txt"><b><NomeMarca nome={st.tema.nomeSistema} /></b><span>{st.tema.empresa} · Central de Chamados</span></span>
        </NavLink>
        <span className="flex-1" />
        <button type="button" className="tb-btn tb-search" onClick={() => setBusca(true)} aria-label="Busca global (Ctrl+K)">
          <Search size={16} /><span className="lbl">Buscar chamado, etiqueta, baia…</span><kbd>Ctrl K</kbd>
        </button>
        <div className="relative">
          <button type="button" data-notif-btn className="tb-btn" aria-label={`Notificações (${naoLidas} não lidas)`} aria-expanded={notif} onClick={() => setNotif((x) => !x)}>
            <Bell size={17} />{naoLidas > 0 && <span className="tb-badge">{naoLidas}</span>}
          </button>
          {notif && <Notificacoes onClose={() => setNotif(false)} />}
        </div>
        <button type="button" className="tb-btn tb-theme" aria-label={modo === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'} onClick={() => setModo(modo === 'escuro' ? 'claro' : 'escuro')}>
          {modo === 'escuro' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <div className="me">
          <span className="me-txt"><b>{user.nome}</b><span>{user.cargo} · {user.depto}</span></span>
          <span className="avatar" aria-hidden="true">{iniciais(user.nome)}</span>
          <button type="button" className="tb-btn" onClick={() => { actions.logout(); nav('/login'); }} aria-label="Sair"><LogOut size={16} /></button>
        </div>
      </header>

      <div className="body">
        <div className={`scrim${aberto ? ' open' : ''}`} onClick={() => setAberto(false)} />
        <nav className={`sidebar${aberto ? ' open' : ''}`} aria-label="Menu principal">
          {menu.map((m, i) => m.secao
            ? <span key={`s${i}`} className="nav-sec">{m.secao}</span>
            : (
              <NavLink key={m.to} to={m.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <m.icon size={17} />
                <span>{m.label}</span>
                {m.badge > 0 && <span className={`nav-badge${m.warn ? ' warn' : ''}`}>{m.badge}</span>}
              </NavLink>
            ))}
          <div className="sidebar-foot">
            {tem(user, 'ROA') && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-tinta-2">Minha situação agora</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {OCUPACOES.map((o) => (
                    <button key={o} type="button" className="pill min-h-[30px] text-[12px] py-0 px-2.5" aria-pressed={ocup === o}
                      onClick={() => { setOcup(o); localStorage.setItem('bencalls:ocupacao', o); }}>{o}</button>
                  ))}
                </div>
              </div>
            )}
            <button type="button" className="btn btn-sm btn-ghost justify-start"
              onClick={() => { if (confirm('Reiniciar a demonstração? Tudo o que foi feito nesta sessão será apagado.')) actions.resetDemo(); }}>
              <RotateCcw size={14} /> Reiniciar demonstração
            </button>
          </div>
        </nav>

        <main className="content" id="conteudo">
          <div className="cascata" key={loc.pathname + (cascataEntrada ? ':e' : '')}><Suspense fallback={<div className="empty">Carregando…</div>}><Outlet context={{ abrir }} /></Suspense></div>
          <Assinatura extra="Modo demonstração · dados fictícios" />
        </main>
      </div>

      {busca && <CommandPalette onClose={() => setBusca(false)} menu={menu.filter((m) => !m.secao)} abrir={abrir} />}
      {chId && st.chamados.some((c) => c.id === chId) && (
        <Drawer onClose={() => fechar('ch')} label="Detalhe do chamado"><TicketDetail id={chId} onClose={() => fechar('ch')} abrir={abrir} /></Drawer>
      )}
      {itemId && st.itens.some((i) => i.id === itemId) && (
        <Drawer onClose={() => fechar('item')} label="Detalhe do item"><ItemDetail id={itemId} onClose={() => fechar('item')} abrir={abrir} /></Drawer>
      )}
      {baiaKey && st.ocupacao[baiaKey] !== undefined && (
        <Drawer onClose={() => fechar('baia')} label="Detalhe da baia"><BaiaDetail chave={baiaKey} onClose={() => fechar('baia')} abrir={abrir} /></Drawer>
      )}

      {entrada && (
        <Entrada nome={user.nome} sistema={st.tema.nomeSistema} subtitulo="Central de Chamados" selos={selos}
          aoSair={() => setCascataEntrada(true)}
          aoTerminar={() => { marcarVisto(diaDe(new Date())); limparLogin(); setEntrada(false); }} />
      )}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tipo}`} role="status">
            <span className="min-w-0 flex-auto">{t.texto}</span>
            <button type="button" className="btn btn-ghost btn-sm btn-icon w-7 min-h-[28px]" aria-label="Fechar aviso" onClick={() => fecharToast(t.id)}><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
