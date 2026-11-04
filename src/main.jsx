import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';

try {
  const modo = localStorage.getItem('bencalls:modo');
  document.documentElement.dataset.theme = modo === 'escuro' ? 'dark' : 'light';
} catch { /* ignora */ }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
