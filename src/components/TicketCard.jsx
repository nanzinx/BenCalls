import clsx from 'clsx';
import { AlertTriangle, Paperclip, ClipboardCheck, ChevronRight } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { baiaCodigo, nomeUser } from '../store/selectors.js';
import { numeroChamado, idade } from '../lib/format.ts';
import { StatusBadge, PrioBadge, Sla } from './ui.jsx';

/** Faixa à esquerda com a cor da prioridade: dá para varrer a lista só pela cor. */
const FAIXA = { Crítica: 'before:bg-ruim-ponto', Alta: 'before:bg-laranja', Média: 'before:bg-aviso-ponto', Baixa: 'before:bg-cinza-ponto' };

export default function TicketCard({ c, onClick, sel, modo = 'lista' }) {
  const { st, user, agora } = useStore();
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
      aria-label={`Abrir chamado ${numeroChamado(c.id)}: ${c.titulo}, ${c.status}`}
      className={clsx(
        'ticket group relative overflow-hidden pl-4 before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[""]',
        FAIXA[c.prioridade],
        sel && 'sel',
        !kanban && 'md:grid md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:gap-5'
      )}
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex items-start justify-between gap-2">
          <span className="t-title leading-snug">{c.titulo}</span>
          {kanban && <PrioBadge prio={c.prioridade} />}
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
        <span className="flex flex-col gap-1.5">
          <Sla ch={c} agora={agora} bar />
          <span className="flex items-center justify-between">{sinais}</span>
        </span>
      ) : (
        <>
          <span className="flex items-center gap-3 max-md:mt-1">
            <Sla ch={c} agora={agora} />
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
