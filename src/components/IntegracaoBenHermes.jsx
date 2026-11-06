// Busca no servidor do BenCalls o que o BenHermes avisou (API de integração) e aplica aqui.
// Só liga quando o servidor diz que a integração está ativa (BENHERMES_SEGREDO configurado).
import { useEffect, useRef } from 'react';
import { useStore } from '../store/store.jsx';
import { numeroChamado } from '../lib/format.ts';

const BASE = '/api/integracoes/benhermes';
const INTERVALO = 15_000;
// Margem na busca: com vários processos no servidor, um evento pode ser gravado com hora um
// pouco anterior ao último visto. Os repetidos são descartados pelo id.
const MARGEM = 60_000;

export async function statusDaIntegracao() {
  try {
    const r = await fetch(`${BASE}/status`, { headers: { Accept: 'application/json' } });
    if (!r.ok || !String(r.headers.get('content-type')).includes('json')) return { ativa: false };
    return await r.json();
  } catch {
    return { ativa: false };
  }
}

export function useIntegracaoBenHermes({ onAbrir }) {
  const { st, actions, toast } = useStore();
  const ref = useRef({ st, onAbrir });
  ref.current = { st, onAbrir };

  useEffect(() => {
    let parar = false;
    let timer;
    const ciclo = async () => {
      try {
        const reg = ref.current.st.integracao?.benhermes;
        const desde = Math.max(0, (reg?.cursor || 0) - MARGEM);
        const r = await fetch(`${BASE}/eventos?desde=${desde}`, { headers: { Accept: 'application/json' } });
        if (r.status === 503 || r.status === 404) { parar = true; return; }
        if (r.ok) {
          const { eventos, cursor } = await r.json();
          const ja = new Set(reg?.aplicados || []);
          const novos = (eventos || []).filter((e) => !ja.has(e.id));
          if (novos.length) {
            const efeitos = actions.aplicarEventosBenHermes(novos, cursor);
            for (const e of efeitos.slice(0, 4)) {
              if (e.tipo === 'chamado-concluido') toast(`✅ ${numeroChamado(e.chamadoId)} concluído: ${e.texto}`, 'ok', { l: 'Abrir', run: () => ref.current.onAbrir(e.chamadoId) });
              else toast(e.texto, 'info');
            }
          }
        }
      } catch { /* sem rede: tenta de novo no próximo ciclo */ }
      if (!parar) timer = setTimeout(ciclo, INTERVALO);
    };
    statusDaIntegracao().then((s) => { if (s.ativa && !parar) ciclo(); });
    return () => { parar = true; clearTimeout(timer); };
  }, [actions, toast]);
}
