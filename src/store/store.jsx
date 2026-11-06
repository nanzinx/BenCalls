// Estado da aplicação. No modo demonstração tudo roda no navegador e fica
// salvo no localStorage. Cada ação indica a rota da BenApi que ela substitui
// (escopo §11.3 e §13.3), para a troca pela API real ser direta.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { seed } from '../data/seed.js';
import { DIA } from '../lib/format.ts';
import { numeroChamado } from '../lib/format.ts';
import { ITEM_NOMES, posicoesDaMesa, posKey } from '../lib/labels.ts';
import {
  alertaTriagem, passoOk, ehPrioritario,
  podeTransicionar, LOCAL_DO_STATUS, podeReabrir, ABERTOS
} from '../lib/rules.ts';
import { acessosDe, baiaCodigo, codigoItem, indiceCatalogo, layoutById, nomeUser, estoquePorTipo } from './selectors.js';
import { paraVoce } from '../lib/notificacoes.ts';
import { whatsappDaBaia, trocarOperador } from '../lib/whatsapp-baias.ts';
import { aplicarAcao, ACAO } from '../lib/benhermes/whatsappManutencao.ts';
import { gravarAlteracao } from '../lib/benhermes/whatsappHistorico.ts';
import { aplicarEventos } from '../lib/integracao-benhermes.ts';

const KEY = 'bencalls:demo:v7';
const SESS = 'bencalls:sessao';
const SESSAO_HORAS = 8;

function carregar() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const st = JSON.parse(raw);
      if (st && st.versao === 7) return st;
    }
  } catch { /* storage indisponível */ }
  return seed();
}

// Sessão: cada aba guarda a sua (sessionStorage), e uma aba nova começa com o último login
// (localStorage). Assim dá para ter o TI numa aba e a supervisora em outra.
function carregarSessao() {
  for (const armazem of [() => sessionStorage, () => localStorage]) {
    try {
      const s = JSON.parse(armazem().getItem(SESS) || 'null');
      if (s && s.expira > Date.now()) return s;
    } catch { /* ignora */ }
  }
  return null;
}

const Ctx = createContext(null);
let nid = 0;
const uid = (p) => `${p}${Date.now().toString(36)}${(nid++).toString(36)}`;

export function StoreProvider({ children }) {
  const [st, setSt] = useState(carregar);
  const [sessao, setSessao] = useState(carregarSessao);
  const [toasts, setToasts] = useState([]);
  const stRef = useRef(st);
  stRef.current = st;

  const salvo = useRef('');
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const txt = JSON.stringify(st);
        if (txt !== salvo.current) { salvo.current = txt; localStorage.setItem(KEY, txt); }
      } catch { /* cheio ou bloqueado */ }
    }, 250);
    return () => clearTimeout(t);
  }, [st]);

  // Tempo real entre abas: o que outra aba gravar (ex.: um chamado novo) chega aqui na hora.
  // Na versão final, isso vem da BenApi (WebSocket ou Server-Sent Events).
  useEffect(() => {
    const f = (e) => {
      if (e.key !== KEY || !e.newValue) return;
      try {
        const novo = JSON.parse(e.newValue);
        if (novo?.versao !== stRef.current.versao) return;
        salvo.current = e.newValue;
        stRef.current = novo;
        setSt(novo);
      } catch { /* ignora */ }
    };
    window.addEventListener('storage', f);
    return () => window.removeEventListener('storage', f);
  }, []);

  const user = sessao ? st.usuarios.find((u) => u.id === sessao.userId) : null;
  const userRef = useRef(user);
  userRef.current = user;

  // acao (opcional): { l: 'Abrir', run } vira um botão no aviso.
  const toast = useCallback((texto, tipo = 'ok', acao = null) => {
    const id = uid('t');
    setToasts((ts) => [...ts, { id, texto, tipo, acao }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), acao ? 9000 : 5200);
  }, []);
  const fecharToast = useCallback((id) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);

  /** Aplica uma alteração sobre uma cópia do estado e registra auditoria (RN08). */
  const mutate = useCallback((recipe) => {
    // Síncrono de propósito: a ação precisa devolver valores (ex.: número do chamado)
    // e chamadas em sequência precisam enxergar o estado anterior já atualizado.
    const next = structuredClone(stRef.current);
    {
      const ctx = {
        agora: Date.now(),
        eu: userRef.current?.id || 'sistema',
        audit(acao, alvo, detalhe = '') {
          next.auditoria.unshift({ id: uid('a'), at: Date.now(), user: userRef.current?.id || 'sistema', acao, alvo: String(alvo), detalhe });
          if (next.auditoria.length > 800) next.auditoria.length = 800;
        },
        notificar(grupo, texto) {
          const canal = next.modulos.benhub ? 'BenHub' : 'E-mail';
          next.notificacoes.unshift({ id: uid('n'), at: Date.now(), canal, grupo, texto, lida: false });
          if (next.notificacoes.length > 120) next.notificacoes.length = 120;
        }
      };
      const retorno = recipe(next, ctx);
      stRef.current = next;
      setSt(next);
      return retorno;
    }
  }, []);

  const actions = useMemo(() => {
    const grupoSup = (s, c) => {
      const L = c.layoutId ? layoutById(s, c.layoutId) : null;
      return L ? `Supervisão ${L.sala} · ${L.nome}` : `Solicitante (${nomeUser(s, c.remetenteId)})`;
    };
    const mudar = (s, ctx, c, status, just) => {
      c.status = status;
      c.hist.push({ status, at: ctx.agora, just, user: ctx.eu });
      ctx.audit(`Status → ${status}`, numeroChamado(c.id), just);
      ctx.notificar(grupoSup(s, c), `${numeroChamado(c.id)} · ${c.titulo} agora está "${status}"${just ? `: ${just}` : ''}`);
    };
    const achar = (s, id) => s.chamados.find((c) => c.id === id);
    const direcionar = (s, ctx, c, paraId, motivo) => {
      c.tecnicoId = paraId;
      c.direcionadoEm = ctx.agora;
      c.direcionadoPor = ctx.eu;
      c.motivoDirecionamento = motivo;
    };
    const verPorMim = (s, ctx, id) => {
      s.ciencia ||= {};
      (s.ciencia[ctx.eu] ||= {})[id] = ctx.agora;
    };
    const proxSeqLocal = (s, local, tipo) => {
      s.seqLocal[local] ||= {};
      const usados = s.itens.filter((i) => i.local.kind === local && i.tipo === tipo).map((i) => i.local.seq);
      const n = Math.max(s.seqLocal[local][tipo] || 0, ...usados, 0) + 1;
      s.seqLocal[local][tipo] = n;
      return n;
    };
    const moverItem = (s, ctx, item, destino, motivo) => {
      const de = codigoItem(s, item);
      if (destino.kind === 'baia') {
        const ocupados = s.itens.filter((i) => i.id !== item.id && i.local.kind === 'baia' && i.local.layoutId === destino.layoutId && i.local.pos === destino.pos && i.tipo === item.tipo);
        item.slot = ocupados.length ? Math.max(...ocupados.map((i) => i.slot || 1)) + 1 : 1;
        item.local = { kind: 'baia', layoutId: destino.layoutId, pos: destino.pos };
      } else {
        item.local = { kind: destino.kind, seq: proxSeqLocal(s, destino.kind, item.tipo) };
        item.slot = 1;
      }
      const para = codigoItem(s, item);
      item.hist.push({ at: ctx.agora, txt: `${motivo}: ${de} → ${para}`, user: nomeUser(s, ctx.eu) });
      ctx.audit('Item movimentado', item.id, `${de} → ${para} (${motivo})`);
      return para;
    };
    const verificarMinimo = (s, ctx, tipo) => {
      const linha = estoquePorTipo(s).find((t) => t.sigla === tipo);
      if (linha && linha.abaixo) ctx.notificar('TI / Administração', `Estoque mínimo: ${linha.nome} com ${linha.disponiveis} disponível(is) (mínimo ${linha.minimo}).`);
    };

    return {
      // POST /api/auth/login  (fase 0: JWT; aqui só simula a sessão com expiração)
      login(userId) {
        const s = { userId, expira: Date.now() + SESSAO_HORAS * 3600_000 };
        localStorage.setItem(SESS, JSON.stringify(s));
        try { sessionStorage.setItem(SESS, JSON.stringify(s)); } catch { /* ignora */ }
        setSessao(s);
        mutate((n, ctx) => { n.auditoria.unshift({ id: uid('a'), at: ctx.agora, user: userId, acao: 'Login', alvo: 'sessão', detalhe: '' }); });
      },
      logout() {
        localStorage.removeItem(SESS);
        try { sessionStorage.removeItem(SESS); } catch { /* ignora */ }
        setSessao(null);
      },
      resetDemo() {
        const novo = seed();
        stRef.current = novo;
        setSt(novo);
        toast('Demonstração reiniciada com os dados originais.');
      },

      // POST /api/v2/chamados — confere a triagem no servidor (RN13) e cria tudo numa transação.
      abrirChamado(p) {
        const s0 = stRef.current;
        const { sits } = indiceCatalogo(s0);
        const itensSel = p.itens || [];
        const sitsUsadas = itensSel.length ? itensSel.map((i) => sits[i.sitId]) : [sits[p.sitId]];
        if (sitsUsadas.some((x) => !x)) throw new Error('Situação inválida.');
        for (const x of sitsUsadas) {
          if (x.outros && (p.descricao || '').trim().length < 10 && !itensSel.some((i) => (i.texto || '').trim().length >= 10)) throw new Error('Descreva o problema em "Outros".');
          if (x.dano && !(p.anexos || []).length) throw new Error('Anexe a foto do dano.');
        }
        if ((p.triagem || []).some((r) => !passoOk(r))) throw new Error('A triagem não foi concluída.');
        return mutate((s, ctx) => {
          const id = s.seqChamado++;
          const princ = sitsUsadas[0];
          const parado = sitsUsadas.some((x) => x.para) || !!p.parado;
          const prioritario = ehPrioritario({ tipoPrioritario: sitsUsadas.some((x) => x.sub.prioritario), operadorParado: parado });
          const alerta = alertaTriagem(p.triagem || []);
          const titulo = itensSel.length > 1
            ? `${itensSel.length} itens — ${itensSel.map((i) => `${ITEM_NOMES[i.tipo] || 'Baia'}: ${sits[i.sitId].nome}`).join(', ')}`
            : `${princ.sub.nome} — ${princ.outros ? `Outros: ${(p.textoOutros || p.descricao || '').trim().slice(0, 48)}` : princ.nome}`;
          const c = {
            id, titulo: p.titulo || titulo, catId: princ.cat.id, subId: princ.sub.id, sitId: princ.id,
            categoria: princ.cat.nome, sub: princ.sub.nome, situacao: princ.nome, prioritario,
            depto: p.depto || princ.cat.equipe,
            layoutId: p.layoutId || null, pos: p.pos || null, local: p.local || '',
            itens: itensSel.filter((i) => i.assetId).map((i) => ({ assetId: i.assetId, tipo: i.tipo, situacao: sits[i.sitId].outros ? `Outros: ${i.texto}` : sits[i.sitId].nome, sitId: i.sitId })),
            ocupante: p.layoutId ? s.ocupacao[`${p.layoutId}:${p.pos}`]?.nome || 'Sem ocupante' : '—',
            remetenteId: ctx.eu, tecnicoId: null, status: 'Em Análise', criadoEm: ctx.agora,
            descricao: (p.descricao || '').trim(), triagem: p.triagem || [], alerta,
            outros: sitsUsadas.some((x) => x.outros), outrosRevisado: false, anexos: p.anexos || [], operadorParado: parado,
            solucao: null, reaberturas: 0,
            hist: [{ status: 'Em Análise', at: ctx.agora, just: p.layoutId ? 'Chamado registrado pelo mapa.' : `Chamado registrado pelo formulário (destino: ${p.depto || princ.cat.equipe}).`, user: ctx.eu }],
            direcionadoEm: ctx.agora, direcionadoPor: ctx.eu, motivoDirecionamento: 'fila'
          };
          s.chamados.push(c);
          const onde = c.layoutId ? baiaCodigo(s, c.layoutId, c.pos) : c.local || 'sem baia';
          ctx.audit('Chamado aberto', numeroChamado(id), `${c.titulo} · ${onde}`);
          ctx.notificar(c.depto === 'Facilities' ? 'Facilities' : 'TI', `Novo chamado ${numeroChamado(id)} · ${onde} · ${c.titulo}${prioritario ? ' · PRIORITÁRIO' : ''}${alerta ? ' · ⚠ alerta de triagem' : ''}`);
          if (c.layoutId) ctx.notificar(grupoSup(s, c), `Chamado ${numeroChamado(id)} aberto para ${onde}.`);
          // Controle de WhatsApps: chamado "WhatsApp banido" já marca o número como banido no mapa.
          if (princ.whatsapp === 'BANIDO' && c.layoutId && s.whatsapp && s.modulos.whatsapp) {
            const L = layoutById(s, c.layoutId);
            const d = new Date(ctx.agora);
            const w = L && whatsappDaBaia(s.whatsapp, L.base, c.pos, d);
            if (w && w.acoes.includes('BANIDO')) {
              s.whatsapp = gravarAlteracao(s.whatsapp, aplicarAcao(s.whatsapp, w.alvo, 'BANIDO', d), d);
              c.hist.push({ status: c.status, at: ctx.agora, just: `WhatsApp ${w.codigo} marcado como banido no Controle de WhatsApps.`, user: ctx.eu });
            }
          }
          return id;
        });
      },

      // RF06: problema resolvido na triagem, sem chamado.
      registrarTriagemResolvida(p) {
        mutate((s, ctx) => {
          s.triagensResolvidas.push({ id: uid('tr'), at: ctx.agora, userId: ctx.eu, ...p });
          ctx.audit('Resolvido na triagem', p.layoutId ? baiaCodigo(s, p.layoutId, p.pos) : '—', p.situacao);
        });
      },

      // PUT /api/chamados/{id}/status
      iniciarExecucao(id) {
        mutate((s, ctx) => {
          const c = achar(s, id);
          if (!c.tecnicoId) direcionar(s, ctx, c, ctx.eu, 'encaminhado');
          verPorMim(s, ctx, c.id);
          mudar(s, ctx, c, 'Em Execução', 'Atendimento iniciado.');
        });
      },
      // O TI pode marcar ou tirar a prioridade de um chamado (fica no histórico).
      definirPrioridade(id, prioritario) {
        mutate((s, ctx) => {
          const c = achar(s, id);
          c.prioritario = prioritario;
          const just = prioritario ? 'Marcado como prioritário.' : 'Prioridade retirada.';
          c.hist.push({ status: c.status, at: ctx.agora, just, user: ctx.eu });
          ctx.audit(prioritario ? 'Marcado como prioritário' : 'Prioridade retirada', numeroChamado(id), nomeUser(s, ctx.eu));
        });
      },
      // Encaminhar o chamado para um técnico específico: ele é avisado ao entrar no site.
      encaminhar(id, paraId) {
        mutate((s, ctx) => {
          const c = achar(s, id);
          direcionar(s, ctx, c, paraId, 'encaminhado');
          if (paraId === ctx.eu) verPorMim(s, ctx, id);
          const nome = nomeUser(s, paraId);
          c.hist.push({ status: c.status, at: ctx.agora, just: `Encaminhado para ${nome}.`, user: ctx.eu });
          ctx.audit('Chamado encaminhado', numeroChamado(id), nome);
          ctx.notificar('TI', `${numeroChamado(id)} · ${c.titulo} foi encaminhado para ${nome}.`);
        });
      },
      // Marca como visto pela pessoa logada (some do aviso "para você").
      marcarVistos(ids) {
        mutate((s, ctx) => { ids.forEach((id) => verPorMim(s, ctx, id)); });
      },
      assumir(id) {
        mutate((s, ctx) => {
          const c = achar(s, id);
          direcionar(s, ctx, c, ctx.eu, 'encaminhado');
          verPorMim(s, ctx, c.id);
          ctx.audit('Chamado assumido', numeroChamado(id), nomeUser(s, ctx.eu));
        });
      },
      mudarStatus(id, status, just) {
        mutate((s, ctx) => mudar(s, ctx, achar(s, id), status, just));
      },
      // POST /api/chamados/{id}/solucao + POST /api/v2/chamados/{id}/laudo + /api/v2/estoque (baixa automática, RF16)
      registrarSolucao(id, { texto, causa, trocas = [] }) {
        mutate((s, ctx) => {
          const c = achar(s, id);
          for (const t of trocas) {
            const antigo = s.itens.find((i) => i.id === t.antigoId);
            const novo = t.novoId ? s.itens.find((i) => i.id === t.novoId) : null;
            if (!antigo) continue;
            const destinoStatus = t.destino || 'Em manutenção';
            const lugar = { kind: antigo.local.kind, layoutId: antigo.local.layoutId, pos: antigo.local.pos };
            antigo.status = destinoStatus;
            moverItem(s, ctx, antigo, { kind: LOCAL_DO_STATUS[destinoStatus] }, `Retirado no chamado ${numeroChamado(id)}${causa ? ` · laudo: ${causa.toLowerCase()}` : ''}`);
            if (novo) {
              novo.status = 'Em uso';
              moverItem(s, ctx, novo, lugar, `Instalado pelo chamado ${numeroChamado(id)}`);
              c.itens.push({ assetId: novo.id, tipo: novo.tipo, situacao: 'Instalado (substituto)', sitId: null, instalado: true });
              verificarMinimo(s, ctx, novo.tipo);
            }
          }
          c.solucao = { texto, causa: causa || null, user: ctx.eu, at: ctx.agora, trocas };
          if (causa === 'Mau uso' && s.modulos.dossie) {
            const dId = `d${s.dossies.length + 1}`;
            s.dossies.unshift({ id: dId, ticketId: id, assetId: c.itens[0]?.assetId || null, layoutId: c.layoutId, pos: c.pos, ocupante: c.ocupante, criadoEm: ctx.agora, status: 'Aguardando RH', decisao: null });
            ctx.notificar('RH', `Novo dossiê para análise: ${numeroChamado(id)} · ${c.ocupante} · laudo "Mau uso".`);
            ctx.audit('Dossiê gerado', dId, numeroChamado(id));
          }
          mudar(s, ctx, c, 'Aguardando Consenso', 'Solução registrada.');
        });
      },
      // POST /api/chamados/{id}/feedback (mantido como "Confirmar solução", §2.3)
      confirmarSolucao(id) {
        mutate((s, ctx) => mudar(s, ctx, achar(s, id), 'Concluído', 'Solicitante confirmou a solução.'));
      },
      // POST /api/v2/chamados/{id}/reabrir
      reabrir(id, just) {
        mutate((s, ctx) => {
          const c = achar(s, id);
          if (c.status === 'Concluído') {
            if (!podeReabrir(c, ctx.agora)) return;
            c.reaberturas = (c.reaberturas || 0) + 1;
          }
          mudar(s, ctx, c, 'Em Execução', `Reaberto: ${just}`);
          if (c.tecnicoId) { c.direcionadoEm = ctx.agora; c.direcionadoPor = ctx.eu; c.motivoDirecionamento = 'voltou'; }
          if (c.tecnicoId) ctx.notificar('TI', `${numeroChamado(id)} voltou para ${nomeUser(s, c.tecnicoId)}: ${just}`);
        });
      },
      comentar(id, texto) {
        mutate((s, ctx) => {
          const c = achar(s, id);
          (c.comentarios ||= []).push({ at: ctx.agora, user: ctx.eu, texto });
          ctx.audit('Comentário', numeroChamado(id), texto.slice(0, 80));
        });
      },
      anexar(id, nome) {
        mutate((s, ctx) => {
          const c = achar(s, id);
          c.anexos.push(nome);
          ctx.audit('Anexo enviado', numeroChamado(id), nome);
        });
      },

      // GET/PUT /api/v2/revisao-outros
      reclassificar(id, sitId) {
        mutate((s, ctx) => {
          const { sits } = indiceCatalogo(s);
          const c = achar(s, id);
          const x = sits[sitId];
          Object.assign(c, { catId: x.cat.id, subId: x.sub.id, sitId: x.id, categoria: x.cat.nome, sub: x.sub.nome, situacao: x.nome, outrosRevisado: true });
          c.hist.push({ status: c.status, at: ctx.agora, just: `Reclassificado de "Outros" para ${x.cat.nome} › ${x.sub.nome} › ${x.nome}.`, user: ctx.eu });
          ctx.audit('Outros reclassificado', numeroChamado(id), `${x.sub.nome} › ${x.nome}`);
        });
      },
      promoverSituacao(id, { subId, nome, passos, flags = {} }) {
        mutate((s, ctx) => {
          const sub = s.catalogo.flatMap((c) => c.subs).find((x) => x.id === subId);
          const nova = { id: uid('s'), nome, passos: passos.filter(Boolean), ...flags };
          const iOutros = sub.sits.findIndex((x) => x.outros);
          sub.sits.splice(iOutros < 0 ? sub.sits.length : iOutros, 0, nova);
          ctx.audit('Situação criada', nome, `${sub.nome} (promovida de "Outros")`);
          if (id) {
            const cat = s.catalogo.find((c) => c.subs.includes(sub));
            const c = achar(s, id);
            Object.assign(c, { catId: cat.id, subId: sub.id, sitId: nova.id, categoria: cat.nome, sub: sub.nome, situacao: nome, outrosRevisado: true });
            c.hist.push({ status: c.status, at: ctx.agora, just: `Texto promovido a nova situação oficial: ${sub.nome} › ${nome}.`, user: ctx.eu });
          }
        });
      },
      // RF08: transformar a solução de um chamado em novo passo de triagem.
      adicionarPasso(sitId, texto) {
        mutate((s, ctx) => {
          for (const c of s.catalogo) for (const sub of c.subs) for (const x of sub.sits) if (x.id === sitId) {
            x.passos.push(texto);
            ctx.audit('Passo de triagem adicionado', x.nome, texto);
          }
        });
      },
      // GET/POST/PUT/DELETE /api/categorias, /api/subcategorias + /api/v2/situacoes
      salvarCatalogo(catalogo, descricao) {
        mutate((s, ctx) => {
          s.catalogo = catalogo;
          ctx.audit('Catálogo alterado', 'catálogo', descricao);
        });
      },

      // /api/v2/estoque/...
      cadastrarItens({ tipo, modelo, serie, fornecedor, compra, garantiaMeses, quantidade }) {
        return mutate((s, ctx) => {
          const ids = [];
          for (let k = 0; k < quantidade; k++) {
            const id = `BEN-${String(s.seqItem++).padStart(4, '0')}`;
            const it = { id, tipo, modelo, serie: quantidade > 1 ? `${serie || tipo}-${k + 1}` : serie || '', fornecedor, compra, garantiaAte: compra + garantiaMeses * 30 * DIA,
              status: 'Novo', local: { kind: 'ALM', seq: proxSeqLocal(s, 'ALM', tipo) }, slot: 1, descartePendente: false,
              hist: [{ at: ctx.agora, txt: 'Entrada no estoque como Novo', user: nomeUser(s, ctx.eu) }] };
            s.itens.push(it);
            ids.push(id);
          }
          ctx.audit('Itens cadastrados', ids.join(', '), `${quantidade} × ${ITEM_NOMES[tipo]} ${modelo}`);
          return ids;
        });
      },
      instalarItem(itemId, layoutId, pos) {
        return mutate((s, ctx) => {
          const it = s.itens.find((i) => i.id === itemId);
          if (!['Novo', 'Disponível (usado)'].includes(it.status)) return null;
          it.status = 'Em uso';
          const cod = moverItem(s, ctx, it, { kind: 'baia', layoutId, pos }, 'Instalado na baia');
          verificarMinimo(s, ctx, it.tipo);
          return cod;
        });
      },
      mudarStatusItem(itemId, novo, just) {
        return mutate((s, ctx) => {
          const it = s.itens.find((i) => i.id === itemId);
          if (!podeTransicionar(it.status, novo)) return false;
          if (novo === 'Descartado') {
            it.descartePendente = true;
            it.hist.push({ at: ctx.agora, txt: `Descarte solicitado por ${nomeUser(s, ctx.eu)}${just ? `: ${just}` : ''} (aguardando aprovação do gestor)`, user: nomeUser(s, ctx.eu) });
            ctx.audit('Descarte solicitado', it.id, just);
            ctx.notificar('Gestão', `Descarte aguardando aprovação: ${it.id} (${ITEM_NOMES[it.tipo]} ${it.modelo}).`);
            return 'pendente';
          }
          it.status = novo;
          moverItem(s, ctx, it, { kind: LOCAL_DO_STATUS[novo] }, `Status alterado para ${novo}${just ? ` (${just})` : ''}`);
          return true;
        });
      },
      // RN05: descarte exige aprovação do gestor.
      decidirDescarte(itemId, aprovar) {
        mutate((s, ctx) => {
          const it = s.itens.find((i) => i.id === itemId);
          it.descartePendente = false;
          if (aprovar) {
            it.status = 'Descartado';
            moverItem(s, ctx, it, { kind: 'BXA' }, `Descarte aprovado por ${nomeUser(s, ctx.eu)}`);
          } else {
            it.hist.push({ at: ctx.agora, txt: `Descarte recusado por ${nomeUser(s, ctx.eu)}`, user: nomeUser(s, ctx.eu) });
            ctx.audit('Descarte recusado', it.id, '');
          }
        });
      },
      definirMinimo(sigla, minimo) {
        mutate((s, ctx) => {
          const t = s.tipos.find((x) => x.sigla === sigla);
          ctx.audit('Estoque mínimo alterado', t.nome, `${t.minimo} → ${minimo}`);
          t.minimo = minimo;
        });
      },
      cadastrarTipo(t) {
        mutate((s, ctx) => {
          s.tipos.push({ ...t, minimo: Number(t.minimo) || 0, modelos: t.modelos || [] });
          ITEM_NOMES[t.sigla] = t.nome;
          ctx.audit('Tipo de item criado', t.sigla, t.nome);
        });
      },

      // RF02: ocupação por turno.
      trocarOcupante(layoutId, pos, nome, turno = 'Manhã') {
        mutate((s, ctx) => {
          const key = `${layoutId}:${pos}`;
          const atual = s.ocupacao[key];
          if (atual) {
            const h = [...s.ocupHist].reverse().find((x) => x.key === key && !x.fim);
            if (h) h.fim = ctx.agora;
          }
          const n = (nome || '').trim();
          s.ocupacao[key] = n ? { nome: n, desde: ctx.agora, turno } : null;
          if (n) s.ocupHist.push({ key, nome: n, inicio: ctx.agora, fim: null });
          if (n && s.modulos.termo) s.termos[key] = { ocupante: n, geradoEm: ctx.agora, assinadoEm: null, versao: (s.termos[key]?.versao || 0) + 1 };
          if (!n) delete s.termos[key];
          ctx.audit('Ocupação alterada', baiaCodigo(s, layoutId, pos), `${atual?.nome || 'vazia'} → ${n || 'vazia'}`);
          // O Controle de WhatsApps acompanha quem senta na baia (o BenCalls é quem sabe).
          const L = layoutById(s, layoutId);
          if (L && s.whatsapp) s.whatsapp = trocarOperador(s.whatsapp, L.base, pos, n, new Date(ctx.agora));
        });
      },
      // ---------- Controle de WhatsApps (regras do BenHermes; cada mudança entra no histórico dele)
      /** Botão do ciclo do banimento (Caiu, Pedi análise, Liberado, Perdido, Troquei o chip, Voltou). */
      whatsappAcao(alvo, acao, extra) {
        return mutate((s, ctx) => {
          const d = new Date(ctx.agora);
          const antes = s.whatsapp;
          const depois = aplicarAcao(antes, alvo, acao, d, extra);
          if (depois === antes) return false;
          s.whatsapp = gravarAlteracao(antes, depois, d);
          const ev = s.whatsapp.historico.at(-1);
          const onde = ev?.codigo || ev?.vaga || 'WhatsApp';
          const quem = ev?.operador ? ` (${ev.operador})` : '';
          ctx.audit(`WhatsApp: ${ACAO[acao].rotulo}`, onde, `${ev?.celular ? `${ev.celular} · ` : ''}${s.whatsapp.manutencaoAtual ? 'na manutenção' : 'pelo painel'}`);
          // Avisa a supervisão da equipe quando um número cai ou é perdido.
          if (alvo.tipo === 'lugar' && ['BANIDO', 'PERDIDO'].includes(acao)) {
            const mesa = s.whatsapp.salas.flatMap((x) => x.mesas).find((m) => m.id === alvo.mesaId);
            const L = mesa && s.layouts.find((l) => l.base.toUpperCase() === mesa.sigla.toUpperCase());
            if (L) ctx.notificar(`Supervisão ${L.sala} · ${L.nome}`, acao === 'BANIDO' ? `WhatsApp ${onde}${quem} caiu. A análise será pedida na manutenção.` : `WhatsApp ${onde}${quem} foi perdido: o chip será trocado.`);
          }
          // Anota nos chamados de WhatsApp abertos daquela baia.
          if (alvo.tipo === 'lugar') {
            const mesa = s.whatsapp.salas.flatMap((x) => x.mesas).find((m) => m.id === alvo.mesaId);
            const L = mesa && s.layouts.find((l) => l.base.toUpperCase() === mesa.sigla.toUpperCase());
            if (L) {
              for (const c of s.chamados) {
                if (c.layoutId === L.id && c.pos === alvo.posicao && c.subId === 'b12' && ABERTOS.includes(c.status)) {
                  c.hist.push({ status: c.status, at: ctx.agora, just: `Controle de WhatsApps: ${ACAO[acao].rotulo.toLowerCase()}${extra?.numeroNovo ? ` (número novo ${extra.numeroNovo})` : ''}.`, user: ctx.eu });
                }
              }
            }
          }
          return true;
        });
      },
      /**
       * Qualquer outra mudança no mapa (manutenção, celulares, importação), sempre por uma função do
       * BenHermes: mudar(mapa, agora) devolve o mapa novo (ou { mapa, ... }).
       */
      whatsappMudar(mudar, auditoria) {
        return mutate((s, ctx) => {
          const d = new Date(ctx.agora);
          const antes = s.whatsapp;
          const r = mudar(antes, d);
          const depois = r && r.salas ? r : r.mapa;
          s.whatsapp = gravarAlteracao(antes, depois, d);
          if (auditoria) ctx.audit(auditoria.acao, auditoria.alvo || 'Controle de WhatsApps', auditoria.detalhe || '');
          return r;
        });
      },
      /**
       * Eventos que chegaram do BenHermes pela API de integração (ou do simulador): atualiza o
       * Controle de WhatsApps e conclui os chamados de WhatsApp quando o número volta a ficar OK.
       */
      aplicarEventosBenHermes(eventos, cursor) {
        return mutate((s, ctx) => {
          const sitsWhatsapp = new Set(Object.values(indiceCatalogo(s).sits).filter((x) => x.whatsapp).map((x) => x.id));
          const efeitos = aplicarEventos(s, eventos, sitsWhatsapp, ctx.agora);
          if (cursor) s.integracao.benhermes.cursor = Math.max(s.integracao.benhermes.cursor || 0, cursor);
          for (const e of efeitos) {
            if (e.tipo === 'chamado-concluido') {
              ctx.audit('Chamado concluído pelo BenHermes', numeroChamado(e.chamadoId), e.texto);
              ctx.notificar(e.grupo, `${numeroChamado(e.chamadoId)} concluído: ${e.texto}`);
            } else if (e.tipo === 'whatsapp') ctx.notificar(e.grupo, e.texto);
            else ctx.notificar('TI', e.texto);
          }
          if (eventos.length) ctx.audit('Integração BenHermes', `${eventos.length} evento(s)`, efeitos.length ? `${efeitos.length} efeito(s)` : 'sem efeito');
          return efeitos;
        });
      },
      /** Troca o mapa inteiro (importar o .json do BenHermes). O histórico vem junto com o arquivo. */
      whatsappSubstituir(mapa, origem) {
        mutate((s, ctx) => {
          s.whatsapp = mapa;
          ctx.audit('WhatsApp: mapa importado', 'Controle de WhatsApps', `${origem} · ${mapa.salas.reduce((n, x) => n + x.mesas.length, 0)} mesas · ${mapa.celulares.length} celulares`);
        });
      },
      // RF19: aceite digital do termo.
      assinarTermo(key) {
        mutate((s, ctx) => {
          s.termos[key].assinadoEm = ctx.agora;
          const [l, p] = key.split(':');
          ctx.audit('Termo assinado', baiaCodigo(s, l, p), s.termos[key].ocupante);
        });
      },
      // RF21
      decidirDossie(id, status, just) {
        mutate((s, ctx) => {
          const d = s.dossies.find((x) => x.id === id);
          d.status = status;
          d.decisao = { user: ctx.eu, at: ctx.agora, just };
          ctx.audit(`Dossiê ${status.toLowerCase()}`, id, just);
        });
      },

      // GET/POST/PUT /api/v2/espacos
      salvarMesa(L) {
        mutate((s, ctx) => {
          // O supervisor responsável passa a ver a mesa (RN06).
          for (const u of s.usuarios) {
            u.equipes = (u.equipes || []).filter((e) => e !== L.id || u.id === L.supervisorId);
            if (u.id === L.supervisorId && !u.equipes.includes(L.id)) u.equipes.push(L.id);
          }
          const existente = s.layouts.find((x) => x.id === L.id);
          if (existente) {
            Object.assign(existente, L);
            ctx.audit('Mesa alterada', L.base, L.nome);
            return;
          }
          s.layouts.push(L);
          let criados = 0;
          for (const p of posicoesDaMesa(L)) {
            const pos = posKey(p);
            s.ocupacao[`${L.id}:${pos}`] = null;
            for (const tipo of L.itens) {
              const id = `BEN-${String(s.seqItem++).padStart(4, '0')}`;
              s.itens.push({ id, tipo, modelo: s.tipos.find((t) => t.sigla === tipo)?.modelos?.[0] || '—', serie: '', fornecedor: '', compra: ctx.agora, garantiaAte: ctx.agora + 365 * DIA,
                status: 'Em uso', local: { kind: 'baia', layoutId: L.id, pos }, slot: 1, descartePendente: false,
                hist: [{ at: ctx.agora, txt: `Cadastrado na criação da mesa ${L.base}`, user: nomeUser(s, ctx.eu) }] });
              criados++;
            }
          }
          ctx.audit('Mesa criada', L.base, `${L.nome} · ${criados} itens cadastrados`);
        });
      },
      salvarUsuario(u) {
        mutate((s, ctx) => {
          const i = s.usuarios.findIndex((x) => x.id === u.id);
          if (i >= 0) s.usuarios[i] = u;
          else s.usuarios.push({ ...u, id: uid('u') });
          ctx.audit(i >= 0 ? 'Usuário alterado' : 'Usuário criado', u.user, `${u.cargo} · ${u.perfil}`);
        });
      },
      // A senha provisória é mostrada uma vez e não fica guardada aqui (na API: hash).
      redefinirSenha(id) {
        mutate((s, ctx) => {
          const u = s.usuarios.find((x) => x.id === id);
          u.trocaSenha = true;
          ctx.audit('Senha provisória gerada', u.user, nomeUser(s, ctx.eu));
        });
      },
      salvarTema(t) {
        mutate((s, ctx) => {
          s.tema = { ...s.tema, ...t };
          ctx.audit('Tema alterado', 'personalização', Object.keys(t).join(', '));
        });
      },
      alternarModulo(k) {
        mutate((s, ctx) => {
          s.modulos[k] = !s.modulos[k];
          ctx.audit(s.modulos[k] ? 'Módulo ligado' : 'Módulo desligado', k);
        });
      },
      salvarCanal(c) {
        mutate((s, ctx) => {
          const i = s.canais.findIndex((x) => x.id === c.id);
          s.canais[i] = c;
          ctx.audit('Canal de notificação alterado', c.evento, `${c.grupo} · ${c.canal}`);
        });
      },
      marcarLidas() {
        mutate((s) => { s.notificacoes.forEach((n) => { n.lida = true; }); });
      }
    };
  }, [mutate, toast]);

  // Relógio da tela ("há 5 min"), atualizado a cada 30 s.
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // O que chegou para a pessoa logada resolver e ela ainda não viu (aviso ao entrar, sino, "novo" nos cartões).
  const paraMim = useMemo(() => (user ? paraVoce(st.chamados, { ...user, acessos: acessosDe(user) }, st.ciencia?.[user.id] || {}) : []),
    [st.chamados, st.ciencia, user]);
  const paraMimIds = useMemo(() => new Set(paraMim.map((x) => x.chamado.id)), [paraMim]);
  const value = useMemo(() => ({ st, user, actions, toast, toasts, fecharToast, agora, paraMim, paraMimIds, abertos: st.chamados.filter((c) => ABERTOS.includes(c.status)) }),
    [st, user, actions, toast, toasts, fecharToast, agora, paraMim, paraMimIds]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore fora do StoreProvider');
  return v;
}
