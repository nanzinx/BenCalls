import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, ListChecks, Package, BellRing, LogIn, Eye, EyeOff } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { PERFIS } from '../data/seed.js';
import { iniciais } from '../lib/format.js';
import { Logo } from '../components/Theme.jsx';
import { Assinatura } from '../components/ui.jsx';
import { rotaInicial } from '../components/Layout.jsx';

const DEMO = [
  ['u1', 'Abre chamados pelo mapa da Equipe 1, faz a triagem e confirma soluções'],
  ['u2', 'Supervisor do Digital: três mesas, inclusive as sem supervisor'],
  ['u3', 'Painel, atendimento com laudo, estoque, mapa geral e revisão de “Outros”'],
  ['u5', 'Recebe os dossiês de mau uso e registra a decisão'],
  ['u6', 'Dashboard, relatórios, gestão, personalização, auditoria e descartes']
];

export default function Login() {
  const { st, actions } = useStore();
  const nav = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState('');
  const t = st.tema;

  const entrar = (id) => {
    actions.login(id);
    const u = st.usuarios.find((x) => x.id === id);
    nav(rotaInicial(u), { replace: true });
  };
  const submit = (e) => {
    e.preventDefault();
    const u = st.usuarios.find((x) => x.user === usuario.trim().toLowerCase());
    if (!u || !senha) return setErro('Usuário ou senha inválidos.');
    if (!u.ativo) return setErro('Este usuário está inativo. Fale com a administração.');
    entrar(u.id);
  };

  return (
    <div className="login">
      <section className="login-hero" style={t.loginImg ? { backgroundImage: `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.55)), url(${t.loginImg})` } : undefined}>
        <div className="row" style={{ gap: 12 }}>
          <Logo tema={t} size={44} />
          <div className="brand-txt"><b style={{ fontSize: 18 }}>{t.nomeSistema}</b><span style={{ fontSize: 13 }}>{t.empresa} · Sistema de Chamados</span></div>
        </div>
        <div className="stack-lg" style={{ maxWidth: 480, position: 'relative', zIndex: 1 }}>
          <h1>{t.loginTitulo}</h1>
          <ul>
            <li><Map size={18} />Abra o chamado clicando na baia, no mapa da sua equipe. O sistema gera o código do item.</li>
            <li><ListChecks size={18} />Triagem guiada antes de abrir: muitos problemas se resolvem ali mesmo.</li>
            <li><Package size={18} />Estoque com etiqueta, histórico e laudo de cada item.</li>
            <li><BellRing size={18} />Status e alertas chegam sozinhos nos grupos do {st.modulos.benhub ? 'BenHub' : 'seu canal'}.</li>
          </ul>
        </div>
        <span className="small" style={{ opacity: 0.85, position: 'relative', zIndex: 1 }}>Versão 2.0 · demonstração com dados fictícios</span>
      </section>

      <section className="login-form">
        <div className="stack-lg" style={{ width: '100%', maxWidth: 400 }}>
          <div>
            <h2 style={{ fontSize: 24, color: 'var(--p-ink)' }}>Entrar</h2>
            <p className="muted" style={{ marginTop: 6 }}>Use seu usuário da {t.empresa}.</p>
          </div>
          <form className="stack" onSubmit={submit} noValidate>
            <label className="field">Usuário
              <input className="input" autoComplete="username" value={usuario} onChange={(e) => { setUsuario(e.target.value); setErro(''); }} placeholder="nome.sobrenome" style={{ minHeight: 48 }} />
            </label>
            <label className="field">Senha
              <span style={{ position: 'relative' }}>
                <input className="input" type={ver ? 'text' : 'password'} autoComplete="current-password" value={senha} onChange={(e) => { setSenha(e.target.value); setErro(''); }} placeholder="••••••••" style={{ minHeight: 48, paddingRight: 44 }} />
                <button type="button" className="btn btn-ghost btn-icon" style={{ position: 'absolute', right: 4, top: 4 }} onClick={() => setVer((x) => !x)} aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}>{ver ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </span>
            </label>
            {erro && <div className="note note-bad" role="alert">{erro}</div>}
            <button type="submit" className="btn btn-primary btn-lg"><LogIn size={17} /> Entrar</button>
            <span className="tiny muted">Na demonstração, qualquer senha funciona com um usuário cadastrado (ex.: carla.souza). Na versão final o login usa token JWT e senha com hash (fase 0).</span>
          </form>
          <div className="stack-sm" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <span className="small bold muted">Entrar direto com um perfil de demonstração</span>
            {DEMO.map(([id, desc]) => {
              const u = st.usuarios.find((x) => x.id === id);
              return (
                <button key={id} type="button" className="persona" onClick={() => entrar(id)}>
                  <span className="avatar">{iniciais(u.nome)}</span>
                  <span className="stack-sm grow" style={{ gap: 1 }}>
                    <b style={{ color: 'var(--p-ink)' }}>{u.nome} <span className="muted" style={{ fontWeight: 500 }}>· {PERFIS[u.perfil].label}</span></b>
                    <span className="small muted">{desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <Assinatura />
        </div>
      </section>
    </div>
  );
}
