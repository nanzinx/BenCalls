import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { StoreProvider, useStore } from './store/store.jsx';
import { tem } from './store/selectors.js';
import { ThemeApplier } from './components/Theme.jsx';
import Layout, { rotaInicial } from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import MeusChamados from './pages/MeusChamados.jsx';
import NovoChamado from './pages/NovoChamado.jsx';
import Painel from './pages/Painel.jsx';
import { Empty } from './components/ui.jsx';
import { Lock } from 'lucide-react';

const MapaGeral = lazy(() => import('./pages/MapaGeral.jsx'));
const Estoque = lazy(() => import('./pages/Estoque.jsx'));
const Revisao = lazy(() => import('./pages/Revisao.jsx'));
const Termos = lazy(() => import('./pages/Termos.jsx'));
const Dossies = lazy(() => import('./pages/Dossies.jsx'));
const Relatorios = lazy(() => import('./pages/Relatorios.jsx'));
const Usuarios = lazy(() => import('./pages/Usuarios.jsx'));
const Catalogo = lazy(() => import('./pages/Catalogo.jsx'));
const Espacos = lazy(() => import('./pages/Espacos.jsx'));
const Personalizacao = lazy(() => import('./pages/Personalizacao.jsx'));
const Auditoria = lazy(() => import('./pages/Auditoria.jsx'));

function Protegida({ acesso, modulo, children }) {
  const { user, st } = useStore();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ de: loc.pathname }} />;
  if ((acesso && !tem(user, acesso)) || (modulo && !st.modulos[modulo])) {
    return <Empty icon={Lock} title="Sem acesso a esta tela">Seu perfil não tem o código de acesso necessário{modulo && !st.modulos[modulo] ? ' ou o módulo está desligado' : ''}.</Empty>;
  }
  return children;
}

function Raiz() {
  const { user } = useStore();
  return <Navigate to={user ? rotaInicial(user) : '/login'} replace />;
}

function Rotas() {
  const { user } = useStore();
  const r = (path, El, acesso, modulo) => <Route path={path} element={<Protegida acesso={acesso} modulo={modulo}><El /></Protegida>} />;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={rotaInicial(user)} replace /> : <Login />} />
      <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<Raiz />} />
        {r('/inicio', MeusChamados, 'DACP')}
        {r('/novo', NovoChamado, 'RC')}
        {r('/painel', Painel, 'PC')}
        {r('/mapa', MapaGeral, 'MAPA')}
        {r('/estoque', Estoque, 'EST')}
        {r('/revisao', Revisao, 'REV')}
        {r('/termos', Termos, 'TERMO', 'termo')}
        {r('/rh', Dossies, 'RH', 'dossie')}
        {r('/relatorios', Relatorios, 'DVGC')}
        {r('/usuarios', Usuarios, 'CU')}
        {r('/catalogo', Catalogo, 'RCSC')}
        {r('/espacos', Espacos, 'ESP')}
        {r('/personalizacao', Personalizacao, 'TEMA')}
        {r('/auditoria', Auditoria, 'AUD')}
        <Route path="*" element={<Empty title="Página não encontrada">Use o menu ao lado para navegar.</Empty>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ThemeApplier />
      <BrowserRouter>
        <Suspense fallback={<div className="empty m-6">Carregando…</div>}>
          <Rotas />
        </Suspense>
      </BrowserRouter>
    </StoreProvider>
  );
}
