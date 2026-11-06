import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Inbox, PlusCircle, KanbanSquare, Map, Package, ClipboardCheck, ShieldAlert, BarChart3, Users, ListTree,
  LayoutGrid, Palette, ScrollText, Search, Bell, BellRing, Menu, Smartphone, LogOut, Moon, Sun, RotateCcw, MessageSquare, FileSignature, X, ChevronDown, PanelLeftClose, PanelLeftOpen
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
import { ABERTOS } from '../lib/rules.ts';
import { alertasUrgentes } from '../lib/whatsapp-baias.ts';
import { useIntegracaoBenHermes } from './IntegracaoBenHermes.jsx';
import { filtrarMapaParaSupervisor } from '../lib/benhermes/whatsappBaias.ts';
import { AvisoParaVoce, LinhaParaVoce, useAlertasEmTempoReal, useTituloComContador, useAvisoDeEntrada, avisosDoNavegadorLigados, ligarAvisosDoNavegador } from './ParaVoce.jsx';

/** Números que aparecem na entrada, conforme o perfil. */
function selosDaEntrada(st, user, paraMim = 0) {
  const sel = selosDoPerfil(st, user);
  if (paraMim > 0) sel.unshift({ valor: paraMim, texto: 'para você', tom: 'alerta' });
  return sel.slice(0, 4);
}

function selosDoPerfil(st, user) {
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
  const prioritarios = abertos.filter((c) => c.prioritario).length;
  const analise = abertos.filter((c) => c.status === 'Em Análise').length;
  const sel = [
    { valor: analise, texto: 'em análise' },
    { valor: abertos.length, texto: 'em andamento' },
    { valor: prioritarios, texto: prioritarios === 1 ? 'prioritário' : 'prioritários', tom: prioritarios ? 'alerta' : 'ok' }
  ];
  if (user.perfil === 'ti') { const n = abertos.filter((c) => c.alerta).length; sel.push({ valor: n, texto: n === 1 ? 'alerta de triagem' : 'alertas de triagem' }); }
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
    // Controle de WhatsApps: o que pede ação (banido sem análise, análise atrasada, restrição vencida, perdido)
    const mapaWpp = st.whatsapp && (user.perfil === 'supervisor' ? filtrarMapaParaSupervisor(st.whatsapp, { id: user.id, displayName: user.nome, username: user.user }) : st.whatsapp);
    const wpp = st.modulos.whatsapp && mapaWpp ? alertasUrgentes(mapaWpp, new Date()).length : 0;
    const termosPend = Object.entries(st.termos).filter(([k, t]) => !t.assinadoEm && minhas.has(k.split(':')[0])).length;
    const itens = [
      { to: '/inicio', label: 'Meus chamados', icon: Inbox, a: 'DACP', badge: aguardando, warn: true },
      { to: '/novo', label: 'Novo chamado', icon: PlusCircle, a: 'RC' },
      { to: '/painel', label: 'Painel de chamados', icon: KanbanSquare, a: 'PC', badge: emAnalise },
      { to: '/mapa', label: 'Mapa geral', icon: Map, a: 'MAPA' },
      { to: '/whatsapp', label: 'Controle de WhatsApps', icon: Smartphone, a: 'WPP', mod: 'whatsapp', badge: wpp, warn: true },
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

function Notificacoes({ onClose, onAbrir }) {
  const { st, actions, paraMim } = useStore();
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
      <div className="max-h-[460px] overflow-auto">
        {paraMim.length > 0 && (
          <div className="border-b border-linha pb-1">
            <div className="flex items-center justify-between gap-2 px-3.5 pt-1 pb-1">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-marca-txt"><BellRing size={13} /> Para você · {paraMim.length}</span>
              <button type="button" className="btn btn-sm btn-ghost min-h-[28px] text-xs" onClick={() => actions.marcarVistos(paraMim.map((x) => x.chamado.id))}>Marcar como vistos</button>
            </div>
            {paraMim.slice(0, 8).map((it) => <LinhaParaVoce key={it.chamado.id} item={it} compacta onAbrir={(id) => { onAbrir(id); onClose(); }} />)}
          </div>
        )}
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

/** Menu no avatar: quem está logado, situação do técnico, tema, reiniciar a demonstração e sair. */
function MenuUsuario({ user, modo, setModo, ocup, setOcup, onReset, onSair }) {
  const [aberto, setAberto] = useState(false);
  const [avisosNav, setAvisosNav] = useState(avisosDoNavegadorLigados);
  const suportaAvisos = typeof window !== 'undefined' && 'Notification' in window;
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); window.removeEventListener('keydown', esc); };
  }, [aberto]);
  const escuro = modo === 'escuro';
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="me" aria-haspopup="menu" aria-expanded={aberto} aria-label={`Menu de ${user.nome}`} onClick={() => setAberto((x) => !x)}>
        <span className="me-txt"><b>{user.nome}</b><span>{user.cargo}</span></span>
        <span className="avatar">{iniciais(user.nome)}{tem(user, 'ROA') && <span className={clsx('me-status', ocup === 'Disponível' ? 'bg-[#3ddc84]' : ocup === 'Inoperante' ? 'bg-[#ff6b6b]' : 'bg-destaque')} aria-hidden="true" />}</span>
        <ChevronDown size={15} className={clsx('opacity-70 transition-transform max-sm:hidden', aberto && 'rotate-180')} />
      </button>
      {aberto && (
        <div className="popover w-72 animate-pop" role="menu">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="avatar bg-marca-suave text-marca-txt">{iniciais(user.nome)}</span>
            <span className="flex min-w-0 flex-col"><b className="truncate">{user.nome}</b><span className="truncate text-xs text-mudo">{user.cargo} · {user.depto}</span></span>
          </div>
          {tem(user, 'ROA') && (
            <div className="flex flex-col gap-1.5 border-t border-linha px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-mudo">Minha situação</span>
              <div className="grid grid-cols-2 gap-1.5">
                {OCUPACOES.map((o) => (
                  <button key={o} type="button" className="pill min-h-8 justify-center px-2 text-xs" aria-pressed={ocup === o} onClick={() => setOcup(o)}>{o}</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col border-t border-linha p-1.5">
            <button type="button" role="menuitemcheckbox" aria-checked={escuro} className="menu-item" onClick={() => setModo(escuro ? 'claro' : 'escuro')}>
              {escuro ? <Sun size={16} /> : <Moon size={16} />}<span className="flex-1">Tema escuro</span>
              <span className={clsx('chave', escuro && 'on')} aria-hidden="true"><i /></span>
            </button>
            {suportaAvisos && (
              <button type="button" role="menuitemcheckbox" aria-checked={avisosNav} className="menu-item"
                title="Avisa no canto da tela, mesmo com o site em outra aba, quando um chamado chegar para você."
                onClick={async () => setAvisosNav(await ligarAvisosDoNavegador(!avisosNav))}>
                <BellRing size={16} /><span className="flex-1">Avisos do navegador</span>
                <span className={clsx('chave', avisosNav && 'on')} aria-hidden="true"><i /></span>
              </button>
            )}
            <button type="button" role="menuitem" className="menu-item" onClick={() => { setAberto(false); onReset(); }}><RotateCcw size={16} /> Reiniciar demonstração</button>
            <button type="button" role="menuitem" className="menu-item text-ruim" onClick={onSair}><LogOut size={16} /> Sair</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { st, user, actions, toasts, fecharToast, paraMim } = useStore();
  const menu = useMenu();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState(false);
  const [notif, setNotif] = useState(false);
  const [modo, setModo] = useModo();
  const [ocup, setOcupEstado] = useState(() => localStorage.getItem('bencalls:ocupacao') || 'Disponível');
  const setOcup = (o) => { setOcupEstado(o); localStorage.setItem('bencalls:ocupacao', o); };
  const [recolhido, setRecolhidoEstado] = useState(() => localStorage.getItem('bencalls:menu-recolhido') === '1');
  const setRecolhido = (f) => setRecolhidoEstado((x) => { const v = typeof f === 'function' ? f(x) : f; localStorage.setItem('bencalls:menu-recolhido', v ? '1' : '0'); return v; });
  const [sp, setSp] = useSearchParams();
  const loc = useLocation();
  const nav = useNavigate();
  const [entrada, setEntrada] = useState(() => deveMostrarEntrada({ vistoEm: lerVistoEm(), hoje: diaDe(new Date()), acabouDeEntrar: loginRecente() }));
  const [cascataEntrada, setCascataEntrada] = useState(false);
  const selos = useMemo(() => selosDaEntrada(st, user, paraMim.length), []); // eslint-disable-line react-hooks/exhaustive-deps

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
  const abrirChamado = useCallback((id) => abrir({ ch: id }), [abrir]);
  const [avisoEntrada, fecharAvisoEntrada] = useAvisoDeEntrada({ entrada, itens: paraMim });
  useAlertasEmTempoReal(paraMim, { ativo: !entrada, onAbrir: abrirChamado });
  useTituloComContador(paraMim.length, st.tema.nomeSistema);
  useIntegracaoBenHermes({ onAbrir: abrirChamado });
  const totalSino = naoLidas + paraMim.length;
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
          <button type="button" data-notif-btn className="tb-btn" aria-label={`Notificações (${paraMim.length} para você, ${naoLidas} não lidas)`} aria-expanded={notif} onClick={() => setNotif((x) => !x)}>
            {paraMim.length > 0 ? <BellRing size={17} className="origin-top animate-[sino_1.2s_ease-in-out_1]" /> : <Bell size={17} />}{totalSino > 0 && <span className="tb-badge">{totalSino}</span>}
          </button>
          {notif && <Notificacoes onClose={() => setNotif(false)} onAbrir={abrirChamado} />}
        </div>
        <MenuUsuario user={user} modo={modo} setModo={setModo} ocup={ocup} setOcup={setOcup}
          onReset={() => { if (confirm('Reiniciar a demonstração? Tudo o que foi feito nesta sessão será apagado.')) actions.resetDemo(); }}
          onSair={() => { actions.logout(); nav('/login'); }} />
      </header>

      <div className="body">
        <div className={`scrim${aberto ? ' open' : ''}`} onClick={() => setAberto(false)} />
        <nav className={clsx('sidebar', aberto && 'open', recolhido && 'recolhido')} aria-label="Menu principal">
          {menu.map((m, i) => m.secao
            ? <span key={`s${i}`} className="nav-sec">{m.secao}</span>
            : (
              <NavLink key={m.to} to={m.to} title={recolhido ? m.label : undefined} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <m.icon size={18} className="flex-none" />
                <span className="nav-txt">{m.label}</span>
                {m.badge > 0 && <span className={`nav-badge${m.warn ? ' warn' : ''}`}>{m.badge}</span>}
              </NavLink>
            ))}
          <div className="sidebar-foot">
            <button type="button" className="nav-item w-full cursor-pointer border-0 bg-transparent text-mudo max-[900px]:hidden" onClick={() => setRecolhido((x) => !x)}
              aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'} title={recolhido ? 'Expandir menu' : undefined}>
              {recolhido ? <PanelLeftOpen size={18} className="flex-none" /> : <PanelLeftClose size={18} className="flex-none" />}
              <span className="nav-txt">Recolher menu</span>
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

      {avisoEntrada && !chId && (
        <AvisoParaVoce itens={paraMim} onFechar={fecharAvisoEntrada}
          onAbrir={(id) => { fecharAvisoEntrada(); abrirChamado(id); }}
          onVerTodos={tem(user, 'PC') ? () => { fecharAvisoEntrada(); nav('/painel?mostrar=paravoce'); } : null} />
      )}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tipo}`} role="status">
            <span className="min-w-0 flex-auto">{t.texto}</span>
            {t.acao && <button type="button" className="btn btn-sm min-h-[28px]" onClick={() => { t.acao.run(); fecharToast(t.id); }}>{t.acao.l}</button>}
            <button type="button" className="btn btn-ghost btn-sm btn-icon w-7 min-h-[28px]" aria-label="Fechar aviso" onClick={() => fecharToast(t.id)}><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
