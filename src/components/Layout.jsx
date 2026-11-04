import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Inbox, PlusCircle, KanbanSquare, Map, Package, ClipboardCheck, ShieldAlert, BarChart3, Users, ListTree,
  LayoutGrid, Palette, ScrollText, Search, Bell, Menu, LogOut, Moon, Sun, RotateCcw, MessageSquare, FileSignature, X
} from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { tem, estoquePorTipo, layoutsDoUsuario } from '../store/selectors.js';
import { iniciais, idade } from '../lib/format.js';
import { Assinatura } from './ui.jsx';
import { Logo, useModo } from './Theme.jsx';
import CommandPalette from './CommandPalette.jsx';
import TicketDetail from './TicketDetail.jsx';
import ItemDetail from './ItemDetail.jsx';
import BaiaDetail from './BaiaDetail.jsx';
import { Drawer } from './ui.jsx';

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
      <div className="row-between" style={{ padding: '12px 14px' }}>
        <div>
          <b>Notificações</b>
          <div className="tiny muted">Cópia do que foi enviado aos grupos do {st.modulos.benhub ? 'BenHub' : 'e-mail'}</div>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={actions.marcarLidas}>Marcar todas como lidas</button>
      </div>
      <div style={{ maxHeight: 420, overflow: 'auto' }}>
        {st.notificacoes.slice(0, 30).map((n) => (
          <div key={n.id} className={`notif${n.lida ? '' : ' unread'}`}>
            <span className="n-ic"><MessageSquare size={15} /></span>
            <div className="grow">
              <div>{n.texto}</div>
              <div className="tiny muted" style={{ marginTop: 3 }}>{n.canal} · grupo <b>{n.grupo}</b> · {idade(n.at)}</div>
            </div>
          </div>
        ))}
        {!st.notificacoes.length && <div className="notif muted">Nenhuma notificação.</div>}
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
          <span className="brand-txt"><b>{st.tema.nomeSistema}</b><span>{st.tema.empresa} · Sistema de Chamados</span></span>
        </NavLink>
        <span className="spacer" />
        <button type="button" className="tb-btn tb-search" onClick={() => setBusca(true)} aria-label="Busca global (Ctrl+K)">
          <Search size={16} /><span className="lbl">Buscar chamado, etiqueta, baia…</span><kbd>Ctrl K</kbd>
        </button>
        <div style={{ position: 'relative' }}>
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
              <div className="stack-sm">
                <span className="small bold" style={{ color: 'var(--text-2)' }}>Minha situação agora</span>
                <div className="row" style={{ gap: 6 }}>
                  {OCUPACOES.map((o) => (
                    <button key={o} type="button" className="pill" style={{ minHeight: 30, fontSize: 12, padding: '0 10px' }} aria-pressed={ocup === o}
                      onClick={() => { setOcup(o); localStorage.setItem('bencalls:ocupacao', o); }}>{o}</button>
                  ))}
                </div>
              </div>
            )}
            <button type="button" className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start' }}
              onClick={() => { if (confirm('Reiniciar a demonstração? Tudo o que foi feito nesta sessão será apagado.')) actions.resetDemo(); }}>
              <RotateCcw size={14} /> Reiniciar demonstração
            </button>
          </div>
        </nav>

        <main className="content" id="conteudo">
          <Suspense fallback={<div className="empty">Carregando…</div>}><Outlet context={{ abrir }} /></Suspense>
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

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tipo}`} role="status">
            <span className="grow">{t.texto}</span>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" style={{ width: 28, minHeight: 28 }} aria-label="Fechar aviso" onClick={() => fecharToast(t.id)}><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
