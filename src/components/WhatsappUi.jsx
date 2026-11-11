// Peças do Controle de WhatsApps usadas na página, no detalhe da baia e no mapa.
import { useState } from 'react';
import clsx from 'clsx';
import { Smartphone, PlusCircle, ExternalLink, Hourglass, Check, Circle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store.jsx';
import { tem, layoutsDoUsuario, indiceCatalogo } from '../store/selectors.js';
import { whatsappDaBaia, tomDaSituacao, TEXTO_SITUACAO } from '../lib/whatsapp-baias.ts';
import { ACAO, acoesPossiveis as acoesPossiveisDe } from '../lib/benhermes/whatsappManutencao.ts';
import { tempoDesde, tempoRestante, restricaoVencida } from '../lib/benhermes/whatsappBaias.ts';
import { textoDoLocal, nomeDoCelular } from '../lib/benhermes/celulares.ts';
import { numeroChamado } from '../lib/format.ts';
import { etapaDoWhatsapp, passosDoCaminho } from '../lib/estagios-whatsapp.ts';

export const TOM_CHIP = {
  ok: 'bg-ok-fundo text-ok',
  ruim: 'bg-ruim-fundo text-ruim',
  aviso: 'bg-aviso-fundo text-aviso',
  escuro: 'bg-tinta text-superficie',
  cinza: 'bg-cinza-fundo text-cinza'
};

const dh = (iso) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** "há 3h", "pedida há 26h", "até 08/11 14:00 · faltam 1d 3h" */
export function tempoDoEstado(e, agora) {
  if (e.situacao === 'OK' || e.situacao === 'NAO_TEM') return '';
  if (e.situacao === 'ANALISE' && e.analisePedidaEm) return `pedida há ${tempoDesde(e.analisePedidaEm, agora)}`;
  if (e.situacao === 'RESTRINGIDO' && e.restritoAte) {
    return restricaoVencida(e, agora) ? `terminou ${dh(e.restritoAte)}` : `até ${dh(e.restritoAte)} · faltam ${tempoRestante(e, agora)}`;
  }
  return `há ${tempoDesde(e.mudouEm, agora)}`;
}

export function SituacaoChip({ estado, agora, sm }) {
  const tom = tomDaSituacao(estado, agora);
  const t = tempoDoEstado(estado, agora);
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full font-semibold', sm ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs', TOM_CHIP[tom])}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', tom === 'escuro' ? 'bg-superficie' : 'bg-current')} aria-hidden="true" />
      {TEXTO_SITUACAO[estado.situacao]}{t && <span className="font-normal opacity-80">· {t}</span>}
    </span>
  );
}

/**
 * Estágio do banimento: linha do tempo (Banido → Em análise → Liberado/Perdido, ou Restringido →
 * Prazo terminou → Voltou), o que está acontecendo e o próximo passo.
 */
export function EstagioWhatsapp({ estado, agora, compacto }) {
  const etapa = etapaDoWhatsapp(estado, agora);
  if (etapa.id === 'ok' || etapa.id === 'nao-tem') return null;
  const passos = passosDoCaminho(etapa.id);
  const atual = { banido: 0, analise: 1, 'analise-atrasada': 1, perdido: 2, restringido: 0, 'restricao-vencida': 1 }[etapa.id] ?? 0;
  return (
    <div className="flex flex-col gap-2">
      {!compacto && (
        <ol className="flex items-center gap-1.5 text-[11px] font-semibold" aria-label="Estágios do WhatsApp">
          {passos.map((p, i) => (
            <li key={p.id} className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className={clsx('grid h-5 w-5 flex-none place-items-center rounded-full border',
                i < atual ? 'border-ok-ponto bg-ok-ponto text-white' : i === atual ? (etapa.aguardandoWhatsapp ? 'border-aviso-ponto bg-aviso-fundo text-aviso' : 'border-ruim-ponto bg-ruim-fundo text-ruim') : 'border-linha-forte text-mudo')}
                aria-current={i === atual ? 'step' : undefined}>
                {i < atual ? <Check size={12} /> : i === atual && etapa.aguardandoWhatsapp ? <Hourglass size={11} /> : <Circle size={7} fill="currentColor" />}
              </span>
              <span className={clsx('truncate', i === atual ? 'text-tinta' : 'text-mudo')}>{p.titulo}</span>
              {i < passos.length - 1 && <span className="h-px min-w-3 flex-1 bg-linha-forte" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      )}
      <div className={clsx('rounded-lg px-3 py-2 text-xs leading-relaxed', etapa.aguardandoWhatsapp ? 'bg-aviso-fundo text-tinta-2' : 'bg-superficie-3 text-tinta-2')}>
        <b className="text-tinta">{etapa.titulo}{etapa.quandoTexto ? ` · ${etapa.quandoTexto}` : ''}.</b> {etapa.descricao}
        {etapa.aguardandoWhatsapp
          ? <span className="mt-1 flex items-center gap-1.5 font-semibold text-aviso"><Hourglass size={12} /> Aguardando o WhatsApp: não há manutenção a fazer agora.</span>
          : etapa.proximoPasso && <span className="mt-1 block font-semibold text-tinta">Próximo passo: {etapa.proximoPasso}</span>}
      </div>
    </div>
  );
}

/** Os botões que fazem sentido para a situação, com os mini-formulários de restrição e chip novo. */
export function BotoesAcao({ alvo, estado, agora, onFeito, tamanho = 'sm' }) {
  const { actions, toast } = useStore();
  const [form, setForm] = useState(null);
  const [qtd, setQtd] = useState('24');
  const [unidade, setUnidade] = useState('horas');
  const [numero, setNumero] = useState('');
  const possiveis = acoesPossiveisDe(estado, agora);
  if (!possiveis.length) return null;

  const fazer = (acao, extra) => {
    try {
      const ok = actions.whatsappAcao(alvo, acao, extra);
      if (ok) { toast(`${ACAO[acao].emoji} ${ACAO[acao].rotulo}.`); onFeito?.(acao); }
      setForm(null);
    } catch (e) { toast(e.message, 'bad'); }
  };
  const btn = tamanho === 'sm' ? 'btn btn-sm' : 'btn';

  if (form === 'RESTRINGIDO') {
    return (
      <form className="flex flex-wrap items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); fazer('RESTRINGIDO', { restricao: { quantidade: Number(qtd), unidade } }); }}>
        <span className="text-xs text-mudo">Restringido por</span>
        <input className="input min-h-[32px] w-16 py-1 text-sm" type="number" min="1" value={qtd} onChange={(e) => setQtd(e.target.value)} aria-label="Quanto tempo" autoFocus />
        <select className="select min-h-[32px] w-auto py-1 text-sm" value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Unidade">
          <option value="horas">horas</option><option value="dias">dias</option>
        </select>
        <button type="submit" className={`${btn} btn-primary`} disabled={!(Number(qtd) > 0)}>Salvar</button>
        <button type="button" className={`${btn} btn-ghost`} onClick={() => setForm(null)}>Voltar</button>
      </form>
    );
  }
  if (form === 'TROCOU_CHIP') {
    return (
      <form className="flex flex-wrap items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); fazer('TROCOU_CHIP', { numeroNovo: numero }); }}>
        <input className="input min-h-[32px] w-44 py-1 text-sm" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Número novo (opcional)" aria-label="Número do chip novo" autoFocus />
        <button type="submit" className={`${btn} btn-primary`}>🔁 Troquei o chip</button>
        <button type="button" className={`${btn} btn-ghost`} onClick={() => setForm(null)}>Voltar</button>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {possiveis.map((a) => {
        // Em OK, "Caiu" e "Restringido" ficam discretos (como no BenHermes).
        const discreto = estado.situacao === 'OK';
        const primario = !discreto && ['PEDIU_ANALISE', 'LIBERADO', 'VOLTOU'].includes(a);
        return (
          <button key={a} type="button" className={clsx(btn, discreto && 'btn-ghost text-mudo', primario && 'btn-primary', a === 'PERDIDO' && 'btn-danger')}
            onClick={() => (a === 'RESTRINGIDO' || a === 'TROCOU_CHIP' ? setForm(a) : fazer(a))}>
            <span aria-hidden="true">{ACAO[a].emoji}</span> {ACAO[a].botao}
          </button>
        );
      })}
    </div>
  );
}

/** Quem pode mexer no WhatsApp de uma mesa: TI, gestão e o supervisor da própria equipe. */
export function podeMexerNoWhatsapp(st, user, layoutId) {
  if (!tem(user, 'WPP')) return false;
  if (user.perfil !== 'supervisor') return true;
  return layoutsDoUsuario(st, user).some((l) => l.id === layoutId);
}

/** Bloco "WhatsApp" no detalhe da baia. */
export function SecaoWhatsappDaBaia({ layout, pos }) {
  const { st, user, actions, toast, agora } = useStore();
  const nav = useNavigate();
  if (!st.modulos.whatsapp || !st.whatsapp || !tem(user, 'WPP')) return null;
  const d = new Date(agora);
  const w = whatsappDaBaia(st.whatsapp, layout.base, pos, d);
  if (!w) return null;
  const pode = podeMexerNoWhatsapp(st, user, layout.id);
  const numero = w.ligada?.vaga.numero;
  const { sits } = indiceCatalogo(st);
  const sitPerdido = Object.values(sits).find((x) => x.whatsapp === 'PERMANENTE');
  const chamadoAberto = st.chamados.find((c) => c.layoutId === layout.id && c.pos === pos && c.subId === 'b12' && !['Concluído', 'Cancelado', 'Negado'].includes(c.status));

  const abrirTrocaDeChip = () => {
    try {
      const id = actions.abrirChamado({
        layoutId: layout.id, pos, sitId: sitPerdido.id, triagem: [],
        descricao: `Número ${numero || 'sem número anotado'}${w.ligada ? ` (${textoDoLocal(w.ligada.celular, w.ligada.vaga)})` : ''} perdido no Controle de WhatsApps. Trocar o chip da vaga.`
      });
      toast(`Chamado ${numeroChamado(id)} aberto para trocar o chip.`);
    } catch (e) { toast(e.message, 'bad'); }
  };

  return (
    <section className={clsx('flex flex-col gap-2.5 rounded-xl border p-3.5', w.atencao ? 'border-ruim-borda bg-ruim-fundo/40' : 'border-linha bg-superficie-2')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold text-mudo"><Smartphone size={14} /> WhatsApp da baia</span>
        <SituacaoChip estado={w.estado} agora={d} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-2">
        <span>{w.ligada ? <>📱 <b>{nomeDoCelular(w.ligada.celular)}</b> · {w.ligada.vaga.grupo} · {w.ligada.vaga.rotulo}</> : 'Sem celular ligado'}</span>
        {numero && <span className="font-mono">{numero}</span>}
        {w.operador && <span>No mapa: {w.operador}</span>}
      </div>
      <EstagioWhatsapp estado={w.estado} agora={d} />
      {pode && <BotoesAcao alvo={w.alvo} estado={w.estado} agora={d} />}
      <div className="flex flex-wrap items-center gap-2">
        {pode && w.estado.situacao === 'PERMANENTE' && sitPerdido && !chamadoAberto && (
          <button type="button" className="btn btn-sm" onClick={abrirTrocaDeChip}><PlusCircle size={14} /> Abrir chamado para trocar o chip</button>
        )}
        {chamadoAberto && <span className="text-xs text-mudo">Chamado {numeroChamado(chamadoAberto.id)} aberto para este WhatsApp.</span>}
        <button type="button" className="btn btn-sm btn-ghost ml-auto" onClick={() => nav('/whatsapp')}><ExternalLink size={14} /> Controle de WhatsApps</button>
      </div>
    </section>
  );
}
