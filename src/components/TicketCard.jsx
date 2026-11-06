import clsx from 'clsx';
import { AlertTriangle, Paperclip, ClipboardCheck, ChevronRight } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { baiaCodigo, nomeUser } from '../store/selectors.js';
import { numeroChamado, idade } from '../lib/format.ts';
import { StatusBadge, PrioBadge } from './ui.jsx';

export default function TicketCard({ c, onClick, sel, modo = 'lista' }) {
  const { st, user, agora, paraMimIds } = useStore();
  const novo = paraMimIds.has(c.id);
  const baia = c.layoutId ? baiaCodigo(st, c.layoutId, c.pos) : c.local || 'Sem baia';
  const quem = c.layoutId ? c.ocupante : nomeUser(st, c.remetenteId);
  const precisaConfirmar = c.status === 'Aguardando Consenso' && c.remetenteId === user.id;
  const kanban = modo === 'kanban';

  const sinais = (
    <span className="flex items-center gap-1.5 text-mudo">
      {c.alerta && <AlertTriangle size={14} className="text-ruim" aria-label="Alerta de triagem"><title>Alerta de triagem</title></AlertTriangle>}
      {c.outros && !c.outrosRevisado && <ClipboardCheck size={14} aria-label="Outros: aguardando revisão"><title>Outros: aguardando revisão</title></ClipboardCheck>}
      {c.anexos.length > 0 && <Paperclip size={14} aria-label="Tem anexo"><title>Tem anexo</title></Paperclip>}
    </span>
  );

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Abrir chamado ${numeroChamado(c.id)}: ${c.titulo}, ${c.status}${c.prioritario ? ', prioritário' : ''}${novo ? ', novo para você' : ''}`}
      className={clsx(
        'ticket group relative overflow-hidden',
        // Faixa vermelha à esquerda só nos prioritários: dá para varrer a lista pela cor.
        c.prioritario && 'pl-4 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-ruim-ponto before:content-[""]',
        sel && 'sel',
        !kanban && 'md:grid md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:gap-5'
      )}
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="t-title leading-snug">
          {novo && <span className="mr-1.5 inline-flex translate-y-[-1px] items-center rounded-full bg-marca px-1.5 py-px align-middle text-[10px] font-bold uppercase tracking-wide text-sobre-marca">Novo</span>}
          {c.titulo}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mudo">
          <span className="font-semibold">{numeroChamado(c.id)}</span>
          <span aria-hidden="true">·</span>
          <span>{idade(c.criadoEm, agora)}</span>
          <span className="tag py-px">{baia}</span>
          <span className="truncate">{quem}</span>
        </span>
      </span>
      {kanban ? (
        <span className="flex items-center justify-between gap-2">
          <PrioBadge prioritario={c.prioritario} />
          {sinais}
        </span>
      ) : (
        <>
          <span className="flex items-center gap-3 max-md:mt-1">
            <PrioBadge prioritario={c.prioritario} />
            {sinais}
          </span>
          <span className="flex items-center gap-2 max-md:mt-1">
            {precisaConfirmar ? <span className="badge b-warn">Confirme se resolveu</span> : <StatusBadge status={c.status} />}
            <ChevronRight size={16} className="text-mudo transition-transform duration-200 group-hover:translate-x-0.5 max-md:hidden" aria-hidden="true" />
          </span>
        </>
      )}
      {kanban && precisaConfirmar && <span className="badge badge-sm b-warn self-start">Confirme se resolveu</span>}
    </button>
  );
}
