// Notificações "para você": o que chegou para a pessoa resolver.
// - Aviso ao entrar no site (depois da entrada animada).
// - Alerta em tempo real (aviso na tela e, se ligado, notificação do navegador) quando algo novo chega.
// - Contador no título da aba: "(2) BenCalls".
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { BellRing, CornerDownRight, Inbox, RotateCcw, ArrowRight, Check } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { baiaCodigo, nomeUser } from '../store/selectors.js';
import { numeroChamado, idade } from '../lib/format.ts';
import { TEXTO_MOTIVO } from '../lib/notificacoes.ts';
import { Modal, PrioBadge } from './ui.jsx';

const ICONE = { encaminhado: CornerDownRight, fila: Inbox, voltou: RotateCcw };
const TOM = { encaminhado: 'bg-marca-suave text-marca-txt', fila: 'bg-superficie-3 text-tinta-2', voltou: 'bg-aviso-fundo text-aviso' };

const CHAVE_NAVEGADOR = 'bencalls:avisos-navegador';
export const avisosDoNavegadorLigados = () => {
  try { return localStorage.getItem(CHAVE_NAVEGADOR) === '1' && 'Notification' in window && Notification.permission === 'granted'; } catch { return false; }
};
export async function ligarAvisosDoNavegador(ligar) {
  try {
    if (!ligar) { localStorage.setItem(CHAVE_NAVEGADOR, '0'); return false; }
    if (!('Notification' in window)) return false;
    const p = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    localStorage.setItem(CHAVE_NAVEGADOR, p === 'granted' ? '1' : '0');
    return p === 'granted';
  } catch { return false; }
}

export function MotivoChip({ motivo }) {
  const I = ICONE[motivo];
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', TOM[motivo])}>
      <I size={12} aria-hidden="true" />{TEXTO_MOTIVO[motivo]}
    </span>
  );
}

/** Uma linha da lista "para você" (usada no aviso e no sino). */
export function LinhaParaVoce({ item, onAbrir, compacta }) {
  const { st, agora } = useStore();
  const c = item.chamado;
  const baia = c.layoutId ? baiaCodigo(st, c.layoutId, c.pos) : c.local || c.depto;
  const quem = item.motivo === 'fila' ? nomeUser(st, c.remetenteId) : nomeUser(st, c.direcionadoPor);
  return (
    <button type="button" onClick={() => onAbrir(c.id)}
      className={clsx('group flex w-full items-start gap-3 rounded-xl text-left transition-colors hover:bg-superficie-2', compacta ? 'px-3.5 py-2.5' : 'px-3 py-3')}>
      <span className={clsx('mt-1.5 h-2 w-2 flex-none rounded-full', c.prioritario ? 'bg-ruim-ponto' : 'bg-marca')} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <MotivoChip motivo={item.motivo} />
          {c.prioritario && <PrioBadge prioritario />}
        </span>
        <span className="font-semibold leading-snug text-tinta">{c.titulo}</span>
        <span className="text-xs text-mudo">
          {numeroChamado(c.id)} · {baia} · {item.motivo === 'fila' ? 'aberto' : 'por'} {item.motivo === 'fila' ? `por ${quem}` : quem} · {idade(item.em, agora)}
        </span>
      </span>
      <ArrowRight size={16} className="mt-1 flex-none text-mudo transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}

/** Aparece ao entrar no site quando há chamados direcionados à pessoa que ela ainda não viu. */
export function AvisoParaVoce({ itens, onAbrir, onFechar, onVerTodos }) {
  const { actions } = useStore();
  const n = itens.length;
  const visiveis = itens.slice(0, 6);
  return (
    <Modal onClose={onFechar}
      title={<span className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-marca-suave text-marca-txt"><BellRing size={18} className="animate-[sino_1.2s_ease-in-out_2]" /></span>{n === 1 ? 'Um chamado chegou para você' : `${n} chamados chegaram para você`}</span>}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={() => { actions.marcarVistos(itens.map((x) => x.chamado.id)); onFechar(); }}><Check size={16} /> Marcar como vistos</button>
          <span className="flex-1" />
          {onVerTodos && <button type="button" className="btn" onClick={onVerTodos}>Ver no painel</button>}
          <button type="button" className="btn btn-primary" onClick={() => onAbrir(itens[0].chamado.id)}>Abrir o mais recente</button>
        </>
      )}>
      <p className="-mt-1 mb-2 text-sm text-mudo">Encaminhados a você, novos na fila do seu departamento ou que voltaram para você desde a última vez.</p>
      <div className="-mx-3 flex flex-col divide-y divide-linha">
        {visiveis.map((it) => <LinhaParaVoce key={it.chamado.id} item={it} onAbrir={onAbrir} />)}
      </div>
      {n > visiveis.length && <p className="mt-2 text-xs text-mudo">E mais {n - visiveis.length} no sino, lá em cima.</p>}
    </Modal>
  );
}

/** Avisa na hora quando chega algo novo para a pessoa (outra aba, outro usuário…). */
export function useAlertasEmTempoReal(itens, { ativo, onAbrir }) {
  const { toast, st } = useStore();
  const anteriores = useRef(null);
  const abrirRef = useRef(onAbrir);
  abrirRef.current = onAbrir;
  useEffect(() => {
    const ids = new Set(itens.map((x) => x.chamado.id));
    if (anteriores.current && ativo) {
      const novos = itens.filter((x) => !anteriores.current.has(x.chamado.id)).slice(0, 3);
      for (const it of novos) {
        const c = it.chamado;
        toast(`${TEXTO_MOTIVO[it.motivo]}: ${numeroChamado(c.id)} · ${c.titulo}`, 'info', { l: 'Abrir', run: () => abrirRef.current(c.id) });
        if (avisosDoNavegadorLigados() && document.visibilityState !== 'visible') {
          try {
            const n = new Notification(`${st.tema.nomeSistema}: ${TEXTO_MOTIVO[it.motivo].toLowerCase()}`, {
              body: `${numeroChamado(c.id)} · ${c.titulo}${c.prioritario ? ' (prioritário)' : ''}`,
              tag: `bencalls-${c.id}`,
              icon: '/favicon.svg'
            });
            n.onclick = () => { window.focus(); abrirRef.current(c.id); n.close(); };
          } catch { /* navegador sem suporte */ }
        }
      }
    }
    anteriores.current = ids;
  }, [itens, ativo, toast, st.tema.nomeSistema]);
}

/** "(3) BenCalls" na aba do navegador. */
export function useTituloComContador(n, nome) {
  useEffect(() => {
    document.title = n > 0 ? `(${n}) ${nome}` : nome;
  }, [n, nome]);
}

/** Estado do aviso de entrada: aparece uma vez por carregamento, depois da entrada animada. */
export function useAvisoDeEntrada({ entrada, itens }) {
  const [fechado, setFechado] = useState(false);
  const mostrar = !entrada && !fechado && itens.length > 0;
  return [mostrar, () => setFechado(true)];
}
