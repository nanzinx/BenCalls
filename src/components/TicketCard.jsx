import { AlertTriangle, MessageCircleQuestion, Paperclip } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { baiaCodigo, nomeUser } from '../store/selectors.js';
import { numeroChamado, idade } from '../lib/format.ts';
import { StatusBadge, PrioBadge, Sla } from './ui.jsx';

export default function TicketCard({ c, onClick, sel, modo = 'lista' }) {
  const { st, user, agora } = useStore();
  const baia = c.layoutId ? baiaCodigo(st, c.layoutId, c.pos) : c.local || 'Sem baia';
  const precisaConfirmar = c.status === 'Aguardando Consenso' && c.remetenteId === user.id;
  return (
    <button type="button" className={`ticket${sel ? ' sel' : ''}`} onClick={onClick}
      aria-label={`Abrir chamado ${numeroChamado(c.id)}: ${c.titulo}, ${c.status}`}>
      <span className="t-top">
        <span className="t-num">{numeroChamado(c.id)} · {idade(c.criadoEm, agora)}</span>
        {modo === 'kanban' ? <PrioBadge prio={c.prioridade} /> : <StatusBadge status={c.status} />}
      </span>
      <span className="t-title">{c.titulo}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="tag">{baia}</span>
        {modo === 'lista' && <PrioBadge prio={c.prioridade} />}
        <span className="text-xs text-tinta-2">{c.layoutId ? c.ocupante : nomeUser(st, c.remetenteId)}</span>
        {c.anexos.length > 0 && <Paperclip size={13} className="text-mudo" aria-label="Tem anexo" />}
      </span>
      <Sla ch={c} agora={agora} bar={modo === 'kanban'} />
      {(c.alerta || (c.outros && !c.outrosRevisado) || precisaConfirmar) && (
        <span className="flex flex-wrap items-center gap-1.5">
          {c.alerta && <span className="badge badge-sm b-bad"><AlertTriangle size={11} /> Alerta de triagem</span>}
          {c.outros && !c.outrosRevisado && <span className="badge badge-sm b-outline">Outros · revisar</span>}
          {precisaConfirmar && <span className="badge badge-sm b-warn"><MessageCircleQuestion size={11} /> Confirme se resolveu</span>}
        </span>
      )}
    </button>
  );
}
