import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ChevronDown, LogIn, Lock } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { PERFIS } from '../data/seed.js';
import { iniciais } from '../lib/format.ts';
import { marcarLogin, lerTentativas, gravarTentativas, registrarErro, MAX_TENTATIVAS } from '../lib/entrada.ts';
import { Logo } from '../components/Theme.jsx';
import { NomeMarca } from '../components/Marca.tsx';
import { Assinatura } from '../components/ui.jsx';
import { rotaInicial } from '../components/Layout.jsx';

const DEMO = ['u1', 'u2', 'u3', 'u5', 'u6'];

/** Tela de acesso no padrão do BenHeimdall e do BenURA: cartão escuro sobre o azul da marca. */
export default function Login() {
  const { st, actions } = useStore();
  const nav = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState(() => { const a = sessionStorage.getItem('bencalls-aviso') || ''; sessionStorage.removeItem('bencalls-aviso'); return a; });
  const [enviando, setEnviando] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const t = st.tema;
  const tent = lerTentativas();
  const bloqueado = tent.bloqueadoAte > agora;

  useEffect(() => {
    if (!bloqueado) return undefined;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [bloqueado]);

  const entrar = (id) => {
    gravarTentativas(null);
    marcarLogin();
    actions.login(id);
    const u = st.usuarios.find((x) => x.id === id);
    nav(rotaInicial(u), { replace: true });
  };

  const enviar = (e) => {
    e.preventDefault();
    if (bloqueado) return;
    setErro('');
    if (!usuario.trim() || !senha) return setErro('Informe usuário e senha.');
    setEnviando(true);
    // Na demonstração não há servidor: um pequeno atraso imita a ida à API.
    setTimeout(() => {
      setEnviando(false);
      const nome = usuario.trim().toLowerCase().replace(/@.*$/, '');
      const u = st.usuarios.find((x) => x.user === nome);
      if (!u || senha.length < 4) {
        const n = registrarErro(lerTentativas(), Date.now());
        gravarTentativas(n);
        setAgora(Date.now());
        return setErro(n.bloqueadoAte > Date.now() ? 'Muitas tentativas. Usuário bloqueado por 5 minutos.' : `Usuário ou senha inválidos. ${MAX_TENTATIVAS - n.erros} tentativa(s) antes do bloqueio.`);
      }
      if (!u.ativo) return setErro('Este usuário está inativo. Fale com a administração.');
      setSenha('');
      entrar(u.id);
    }, 450);
  };

  const restante = Math.max(0, Math.ceil((tent.bloqueadoAte - agora) / 1000));

  return (
    <section className="gate" aria-label="Entrar no BenCalls" style={t.loginImg ? { backgroundImage: `linear-gradient(160deg, rgba(6,22,56,.88), rgba(11,58,130,.8)), url(${t.loginImg})` } : undefined}>
      <div className="gate-bolha b1" aria-hidden="true" />
      <div className="gate-bolha b2" aria-hidden="true" />
      <div className="gate-grade" aria-hidden="true" />
      <div className="stack" style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1, gap: 18 }}>
        <form className="login-card" onSubmit={enviar} noValidate>
          <div className="stack-sm" style={{ gap: 6 }}>
            <span className="marca-hover" style={{ marginBottom: 8, width: 44 }}><Logo tema={t} size={44} /></span>
            <b className="gate-nome"><NomeMarca nome={t.nomeSistema} /></b>
            <span className="gate-sub">{t.empresa} · Central de Chamados</span>
          </div>
          <p className="gate-lead">{t.loginTitulo} Acesso para supervisores, TI, RH e gestão.</p>
          <label>Usuário ou e-mail
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="nome.sobrenome@benconsig.com" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus disabled={bloqueado} />
          </label>
          <label>Senha
            <span style={{ position: 'relative' }}>
              <input type={ver ? 'text' : 'password'} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" style={{ paddingRight: 46 }} disabled={bloqueado} />
              <button type="button" className="btn btn-ghost btn-icon" style={{ position: 'absolute', right: 3, top: 3, color: '#a9b5c9' }} onClick={() => setVer((x) => !x)} aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}>{ver ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </span>
          </label>
          <p className="gate-msg" role="alert">{bloqueado ? `Bloqueado por excesso de tentativas. Tente de novo em ${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}.` : erro}</p>
          <button className="btn btn-primary" type="submit" disabled={enviando || bloqueado}>
            {bloqueado ? <><Lock size={16} /> Bloqueado</> : enviando ? 'Entrando…' : <><LogIn size={16} /> Entrar</>}
          </button>
          <p className="gate-hint">A sessão expira após 30 min sem uso. Depois de {MAX_TENTATIVAS} senhas erradas, o usuário fica bloqueado por 5 min.</p>

          <details className="gate-demo">
            <summary>Entrar com um perfil de demonstração <ChevronDown size={16} /></summary>
            <span className="gate-hint">Dados fictícios. Na demonstração, qualquer senha com 4+ caracteres funciona para um usuário cadastrado (ex.: carla.souza).</span>
            <div className="gate-perfis">
              {DEMO.map((id) => {
                const u = st.usuarios.find((x) => x.id === id);
                return (
                  <button key={id} type="button" className="gate-perfil" onClick={() => entrar(id)} aria-label={`Entrar como ${u.nome}, ${PERFIS[u.perfil].label}`}>
                    <span className="avatar">{iniciais(u.nome)}</span>
                    <span><b>{u.nome.split(' ')[0]}</b><span>{PERFIS[u.perfil].label}</span></span>
                  </button>
                );
              })}
            </div>
          </details>
        </form>
        <Assinatura />
      </div>
    </section>
  );
}
