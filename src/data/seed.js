// Dados fictícios da demonstração. Gerados de forma determinística (mesma
// semente = mesmos dados), relativos ao momento em que a demo é iniciada.
import { MIN, DIA } from '../lib/format.ts';
import { ITENS_PADRAO, posicoesDaMesa, posKey } from '../lib/labels.ts';
import { ehPrioritario } from '../lib/rules.ts';
import { seedWhatsapp } from './seedWhatsapp.js';

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- usuários
// Códigos de acesso: os da BenApi (DACP, RC, PC, ASC, ROA, DVGC, CU, RCSC)
// + os novos do front v2 (EST, ESP, MAPA, REV, RH, TEMA, AUD, TERMO) e o WPP (WhatsApp das Baias, vindo do BenHermes).
export const ACESSOS = {
  DACP: 'Meus chamados',
  RC: 'Registrar chamado',
  PC: 'Painel de chamados',
  ASC: 'Atender chamados',
  ROA: 'Registro de ocupação do agente',
  DVGC: 'Dashboard geral',
  CU: 'Cadastro de usuários',
  RCSC: 'Catálogo de chamados',
  EST: 'Estoque e patrimônio',
  ESP: 'Espaços e baias',
  MAPA: 'Mapa geral',
  REV: 'Revisão de "Outros"',
  RH: 'Dossiês do RH',
  TERMO: 'Termos de responsabilidade',
  TEMA: 'Personalização e módulos',
  AUD: 'Auditoria',
  APROV: 'Aprovar descartes',
  WPP: 'WhatsApp das Baias'
};

export const PERFIS = {
  // Todo perfil abre e acompanha os próprios chamados (DACP + RC).
  supervisor: { label: 'Supervisor', acessos: ['DACP', 'RC', 'TERMO', 'WPP'] },
  // O TI também configura o sistema: logins, personalização e auditoria.
  ti: { label: 'Técnico de TI', acessos: ['DACP', 'RC', 'PC', 'ASC', 'ROA', 'EST', 'ESP', 'MAPA', 'REV', 'DVGC', 'RCSC', 'TERMO', 'CU', 'TEMA', 'AUD', 'WPP'] },
  rh: { label: 'RH', acessos: ['DACP', 'RC', 'RH', 'TERMO', 'DVGC'] },
  gestor: { label: 'Gestão', acessos: ['DACP', 'RC', 'PC', 'DVGC', 'MAPA', 'EST', 'CU', 'RCSC', 'ESP', 'TEMA', 'AUD', 'RH', 'TERMO', 'APROV', 'REV', 'WPP'] }
};

export function seedUsuarios() {
  return [
    { id: 'u1', nome: 'Carla Souza', user: 'carla.souza', cargo: 'Supervisora', perfil: 'supervisor', depto: 'Operacional', equipes: ['OP1'], ativo: true },
    { id: 'u2', nome: 'Rafael Nunes', user: 'rafael.nunes', cargo: 'Supervisor', perfil: 'supervisor', depto: 'Digital', equipes: ['DG-M1', 'DG-M2', 'DG-M3'], ativo: true },
    { id: 'u3', nome: 'Diego Lima', user: 'diego.lima', cargo: 'Técnico de TI', perfil: 'ti', depto: 'TI', equipes: [], ativo: true },
    { id: 'u4', nome: 'Bruna Costa', user: 'bruna.costa', cargo: 'Técnica de TI', perfil: 'ti', depto: 'TI', equipes: [], ativo: true },
    { id: 'u5', nome: 'Paula Reis', user: 'paula.reis', cargo: 'Analista de RH', perfil: 'rh', depto: 'RH', equipes: [], ativo: true },
    { id: 'u6', nome: 'Marina Alves', user: 'marina.alves', cargo: 'Diretora', perfil: 'gestor', depto: 'Diretoria', equipes: [], ativo: true },
    { id: 'u7', nome: 'Juliana Prado', user: 'juliana.prado', cargo: 'Supervisora', perfil: 'supervisor', depto: 'Operacional', equipes: ['OP2'], ativo: true },
    { id: 'u8', nome: 'Marcos Teixeira', user: 'marcos.teixeira', cargo: 'Supervisor', perfil: 'supervisor', depto: 'Operacional', equipes: ['OP3'], ativo: true },
    { id: 'u9', nome: 'Fernanda Lopes', user: 'fernanda.lopes', cargo: 'Supervisora', perfil: 'supervisor', depto: 'Operacional', equipes: ['OP4'], ativo: true },
    { id: 'u10', nome: 'Thiago Ramos', user: 'thiago.ramos', cargo: 'Supervisor', perfil: 'supervisor', depto: 'Operacional', equipes: ['OP5'], ativo: true },
    { id: 'u11', nome: 'João Pedro', user: 'joao.pedro', cargo: 'Supervisor', perfil: 'supervisor', depto: 'Operacional', equipes: [], ativo: false }
  ];
}

// ---------------------------------------------------------------- espaços
const PADRAO_BEN = ['grupo', 'lado', 'posicao', 'item'];

export function seedLayouts() {
  const ops = [1, 2, 3, 4, 5].map((n) => ({
    id: `OP${n}`, base: `OP${n}`, nome: `Equipe ${n}`, sala: 'Operacional', centro: ['SUP'], esq: 4, dir: 4,
    inicio: 'sup', padrao: PADRAO_BEN, sep: '-', itens: ITENS_PADRAO, desativadas: {}, rodape: 'início da mesa',
    supervisorId: { 1: 'u1', 2: 'u7', 3: 'u8', 4: 'u9', 5: 'u10' }[n]
  }));
  return [
    ...ops,
    { id: 'DG-M1', base: 'DG-M1', nome: 'Mesa principal', sala: 'Digital', centro: ['SUP', 'SUB'], esq: 5, dir: 5, inicio: 'sup',
      padrao: PADRAO_BEN, sep: '-', itens: ITENS_PADRAO, desativadas: {}, rodape: 'início da mesa', supervisorId: 'u2' },
    { id: 'DG-M2', base: 'DG-M2', nome: 'Mesa 2', sala: 'Digital', centro: [], esq: 3, dir: 3, inicio: 'porta',
      padrao: PADRAO_BEN, sep: '-', itens: ITENS_PADRAO, desativadas: {}, rodape: 'porta', supervisorId: 'u2' },
    { id: 'DG-M3', base: 'DG-M3', nome: 'Mesa 3', sala: 'Digital', centro: [], esq: 3, dir: 3, inicio: 'porta',
      padrao: PADRAO_BEN, sep: '-', itens: ITENS_PADRAO, desativadas: {}, rodape: 'porta', supervisorId: 'u2' }
  ];
}

// ---------------------------------------------------------------- catálogo
// 3 níveis (§2.8): categoria › tipo (subcategoria da BenApi) › situação (nova).
let sid = 0;
const S = (nome, extra = {}) => ({ id: `s${++sid}`, nome, passos: [], ...extra });
const OUTROS = () => S('Outros', { outros: true });

export function seedCatalogo() {
  sid = 0;
  return [
    { id: 'c1', nome: 'Periférico', icone: 'headphones', equipe: 'TI', subs: [
      { id: 'b1', nome: 'Headset', item: 'HS', prioritario: false, sits: [
        S('Sem áudio', { para: true, passos: ['Conferir se o plug está bem encaixado', 'Trocar o headset de porta USB', 'Verificar o volume e o dispositivo de áudio no softphone'] }),
        S('Microfone não capta', { para: true, passos: ['Verificar se o microfone está no mudo', 'Trocar o headset de porta USB'] }),
        S('Fio ou espuma danificado', { dano: true }),
        S('Quebrado', { dano: true }),
        OUTROS()] },
      { id: 'b2', nome: 'Mouse', item: 'MS', prioritario: false, sits: [
        S('Não funciona', { passos: ['Trocar o mouse de porta USB', 'Limpar o sensor e testar em outra superfície'] }),
        S('Clique falhando', { passos: ['Testar o clique em outro programa', 'Trocar o mouse de porta USB'] }),
        S('Quebrado', { dano: true }),
        OUTROS()] },
      { id: 'b3', nome: 'Teclado', item: 'TC', prioritario: false, sits: [
        S('Não funciona', { passos: ['Trocar o teclado de porta USB', 'Reiniciar o computador'] }),
        S('Teclas falhando', { passos: ['Trocar o teclado de porta USB', 'Verificar se não há teclas presas'] }),
        S('Quebrado', { dano: true }),
        OUTROS()] }
    ] },
    { id: 'c2', nome: 'Hardware', icone: 'monitor', equipe: 'TI', subs: [
      { id: 'b4', nome: 'Computador', item: 'PC', prioritario: true, sits: [
        S('Não liga', { para: true, passos: ['Conferir se o cabo de energia está ligado', 'Conferir o cabo de rede', 'Reiniciar o computador'] }),
        S('Lento ou travando', { passos: ['Fechar programas e abas que não estão em uso', 'Reiniciar o computador'] }),
        S('Argus não abre', { para: true, passos: ['Fechar e abrir a Argus novamente', 'Reiniciar o computador', 'Testar o login em outra baia'] }),
        S('Sem rede', { para: true, passos: ['Conferir se o cabo de rede está encaixado', 'Verificar se as baias vizinhas também estão sem rede'] }),
        OUTROS()] },
      { id: 'b5', nome: 'Monitor', item: 'MN', prioritario: false, sits: [
        S('Sem imagem', { para: true, passos: ['Conferir os cabos de energia e de vídeo', 'Apertar o botão de entrada (input) do monitor'] }),
        S('Não liga', { para: true, passos: ['Conferir o cabo de energia', 'Testar outra tomada'] }),
        S('Tela danificada', { dano: true }),
        OUTROS()] }
    ] },
    { id: 'c3', nome: 'Sistemas', icone: 'app', equipe: 'TI', subs: [
      { id: 'b6', nome: 'Argus', prioritario: true, sits: [
        S('Erro ao entrar', { para: true, passos: ['Conferir usuário e senha (caps lock)', 'Fechar e abrir a Argus novamente'] }),
        S('Discador não liga', { para: true, passos: ['Sair e entrar na campanha', 'Reiniciar o softphone'] }),
        OUTROS()] },
      { id: 'b7', nome: 'Acessos e senhas', prioritario: false, sits: [
        S('Senha bloqueada', { passos: ['Aguardar 15 minutos e tentar de novo'] }),
        S('Pedido de acesso', { solicitacao: true }),
        OUTROS()] },
      { id: 'b8', nome: 'Rede e internet', prioritario: true, sits: [
        S('Sala inteira sem internet', { para: true, passos: ['Verificar se outras salas também estão sem internet'] }),
        S('Wi-Fi da sala de reunião', { passos: ['Esquecer a rede e conectar de novo'] }),
        OUTROS()] }
    ] },
    { id: 'c4', nome: 'Infraestrutura', icone: 'building', equipe: 'Facilities', subs: [
      { id: 'b9', nome: 'Mobiliário e energia', prioritario: false, baia: true, sits: [
        S('Cadeira quebrada', { dano: true, semLaudo: true }),
        S('Tomada sem energia', { para: true, passos: ['Testar o equipamento em outra tomada'] }),
        OUTROS()] },
      { id: 'b10', nome: 'Salas e ambiente', prioritario: false, sits: [
        S('Ar-condicionado', { passos: ['Conferir se o controle está com pilha'] }),
        S('Sala de reunião', { passos: [] }),
        OUTROS()] }
    ] },
    { id: 'c5', nome: 'Solicitações', icone: 'clipboard', equipe: 'TI', subs: [
      { id: 'b11', nome: 'Pessoas', prioritario: false, sits: [
        S('Novo colaborador', { solicitacao: true }),
        S('Desligamento', { solicitacao: true }),
        S('Troca de baia', { solicitacao: true }),
        OUTROS()] }
    ] },
    // Integração com o WhatsApp das Baias (BenHermes): "whatsapp" diz o que a situação faz no mapa.
    { id: 'c6', nome: 'WhatsApp e celular', icone: 'phone', equipe: 'TI', subs: [
      { id: 'b12', nome: 'WhatsApp da baia', prioritario: false, sits: [
        S('WhatsApp banido', { whatsapp: 'BANIDO', passos: ['Abrir o WhatsApp e confirmar a mensagem de conta banida'] }),
        S('Número perdido (trocar o chip)', { whatsapp: 'PERMANENTE', solicitacao: true }),
        S('Celular corporativo com defeito', { passos: ['Reiniciar o celular', 'Conferir se o carregador está funcionando'] }),
        OUTROS()] }
    ] }
  ];
}

export function seedTiposItem() {
  return [
    { sigla: 'PC', nome: 'Computador', minimo: 1, modelos: ['Dell OptiPlex 3080', 'Dell OptiPlex 3090'] },
    { sigla: 'MN', nome: 'Monitor', minimo: 2, modelos: ['AOC 22B2H', 'LG 22MK400'] },
    { sigla: 'TC', nome: 'Teclado', minimo: 2, modelos: ['Logitech K120'] },
    { sigla: 'MS', nome: 'Mouse', minimo: 3, modelos: ['Logitech M90'] },
    { sigla: 'HS', nome: 'Headset', minimo: 5, modelos: ['Plantronics C3220', 'Plantronics C3210'] },
    { sigla: 'CB', nome: 'Cabo/adaptador', minimo: 4, modelos: ['Cabo HDMI 1,5 m', 'Adaptador USB-C'] }
  ];
}

const NOMES = ['Ana', 'Bruno', 'Camila', 'Daniel', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'Júlio', 'Karina', 'Lucas', 'Mariana', 'Nícolas', 'Olívia', 'Pedro', 'Queila', 'Rodrigo', 'Sabrina', 'Tiago', 'Úrsula', 'Vinícius', 'Wesley', 'Yasmin', 'Leandro', 'Patrícia', 'Renata', 'Sérgio', 'Talita', 'Vitor', 'Larissa', 'Mateus', 'Priscila', 'Caio', 'Débora', 'Igor'];
const SOBRENOMES = ['Almeida', 'Barros', 'Cardoso', 'Dias', 'Esteves', 'Freitas', 'Gomes', 'Horta', 'Ibrahim', 'Jardim', 'Lacerda', 'Moraes', 'Nogueira', 'Oliveira', 'Pires', 'Queiroz', 'Rocha', 'Santana', 'Toledo', 'Vieira'];
const VAZIAS = ['OP1:E4', 'DG-M1:E5', 'OP3:D4', 'DG-M3:D3', 'OP5:E3'];

export function seed(agora = Date.now()) {
  const rnd = prng(20261104);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const usuarios = seedUsuarios();
  const layouts = seedLayouts();
  const catalogo = seedCatalogo();
  const tipos = seedTiposItem();
  const nomeUser = Object.fromEntries(usuarios.map((u) => [u.id, u.nome]));

  // ---------- ocupação (RF02)
  const ocupacao = {};
  const ocupHist = [];
  let nI = 0;
  for (const L of layouts) {
    for (const p of posicoesDaMesa(L)) {
      const k = posKey(p);
      const key = `${L.id}:${k}`;
      let nome = null;
      if (p.papel === 'SUP') nome = nomeUser[L.supervisorId];
      else if (p.papel === 'SUB') nome = 'Ana Lacerda (sub-líder)';
      else if (!VAZIAS.includes(key)) {
        nome = `${NOMES[nI % NOMES.length]} ${SOBRENOMES[(nI * 7) % SOBRENOMES.length]}`;
        nI++;
      }
      const desde = agora - int(20, 400) * DIA;
      ocupacao[key] = nome ? { nome, desde, turno: p.papel ? 'Integral' : pick(['Manhã', 'Tarde']) } : null;
      if (nome) ocupHist.push({ key, nome, inicio: desde, fim: null });
    }
  }
  // Um ocupante anterior em OP1-E2 para mostrar o histórico da baia.
  ocupHist.push({ key: 'OP1:E2', nome: 'Wesley Moraes', inicio: agora - 420 * DIA, fim: ocupacao['OP1:E2'].desde });

  // ---------- estoque
  const itens = [];
  let seqId = 100;
  const novoId = () => `BEN-${String(++seqId).padStart(4, '0')}`;
  const tipoInfo = Object.fromEntries(tipos.map((t) => [t.sigla, t]));
  const fornecedores = { PC: 'Dell Brasil', MN: 'Kalunga Corporativo', TC: 'Kalunga Corporativo', MS: 'Kalunga Corporativo', HS: 'Headset Center', CB: 'Kalunga Corporativo' };
  const mkItem = (tipo, local, status, extra = {}) => {
    const compra = agora - int(60, 900) * DIA;
    const garantiaMeses = tipo === 'PC' ? 36 : tipo === 'MN' ? 24 : 12;
    const it = {
      id: novoId(), tipo, modelo: pick(tipoInfo[tipo].modelos), serie: `${tipo}${int(100000, 999999)}`,
      fornecedor: fornecedores[tipo], compra, garantiaAte: compra + garantiaMeses * 30 * DIA,
      status, local, slot: 1, descartePendente: false,
      hist: [{ at: compra, txt: 'Entrada no estoque como Novo', user: 'Sistema' }],
      ...extra
    };
    if (local.kind === 'baia') it.hist.push({ at: compra + int(1, 10) * DIA, txt: `Instalado na baia ${local.layoutId}-${local.pos}`, user: 'Diego Lima' });
    itens.push(it);
    return it;
  };
  for (const L of layouts) {
    for (const p of posicoesDaMesa(L)) {
      const pos = posKey(p);
      for (const t of L.itens) mkItem(t, { kind: 'baia', layoutId: L.id, pos }, 'Em uso');
      if (pos === 'SUP' && L.id === 'DG-M1') {
        const mn2 = mkItem('MN', { kind: 'baia', layoutId: L.id, pos }, 'Em uso');
        mn2.slot = 2;
      }
    }
  }
  const seqLocal = { ALM: {}, MNT: {}, GAR: {}, BXA: {} };
  const local = (k, tipo) => {
    seqLocal[k][tipo] = (seqLocal[k][tipo] || 0) + 1;
    return { kind: k, seq: seqLocal[k][tipo] + (k === 'ALM' ? 3 : 0) };
  };
  const alm = { HS: ['Novo', 'Novo', 'Disponível (usado)'], MS: ['Novo', 'Novo'], TC: ['Novo', 'Novo', 'Disponível (usado)', 'Novo'], MN: ['Novo', 'Disponível (usado)'], PC: ['Novo'], CB: ['Novo', 'Novo', 'Novo', 'Novo', 'Novo', 'Novo'] };
  for (const [t, sts] of Object.entries(alm)) for (const st of sts) mkItem(t, local('ALM', t), st);
  mkItem('PC', local('MNT', 'PC'), 'Em manutenção', { modelo: 'Dell OptiPlex 3080' });
  const garMn = mkItem('MN', local('GAR', 'MN'), 'Em garantia', { modelo: 'AOC 22B2H' });
  garMn.hist.push({ at: agora - 12 * DIA, txt: 'Enviado ao fornecedor para troca (tela com listras)', user: 'Diego Lima' });
  mkItem('HS', local('BXA', 'HS'), 'Descartado', { modelo: 'Plantronics C3210' });
  const qHs = mkItem('HS', local('MNT', 'HS'), 'Quebrado', { modelo: 'Plantronics C3210' });
  qHs.descartePendente = true;
  qHs.hist.push({ at: agora - 2 * DIA, txt: 'Descarte solicitado por Diego Lima (aguardando aprovação do gestor)', user: 'Diego Lima' });
  // Garantias vencendo (RF28)
  itens.filter((i) => i.tipo === 'PC').slice(0, 3).forEach((i, k) => { i.garantiaAte = agora + (12 + k * 9) * DIA; });

  const itemNaBaia = (layoutId, pos, tipo) => itens.find((i) => i.local.kind === 'baia' && i.local.layoutId === layoutId && i.local.pos === pos && i.tipo === tipo);

  // ---------- chamados históricos (30 dias) para relatórios
  const subs = catalogo.flatMap((c) => c.subs.map((s) => ({ ...s, cat: c })));
  const pesos = [['b1', 30], ['b2', 10], ['b3', 7], ['b4', 22], ['b5', 12], ['b6', 9], ['b7', 6], ['b8', 2], ['b9', 3], ['b11', 3]];
  const totalPeso = pesos.reduce((a, [, p]) => a + p, 0);
  const sorteiaSub = () => {
    let r = rnd() * totalPeso;
    for (const [id, p] of pesos) { if ((r -= p) <= 0) return subs.find((s) => s.id === id); }
    return subs[0];
  };
  const posicoes = layouts.flatMap((L) => posicoesDaMesa(L).filter((p) => !p.papel).map((p) => ({ L, pos: posKey(p) })));
  // baias "problemáticas" aparecem mais (RF/relatório de baias críticas)
  const quentes = ['OP1:D2', 'DG-M1:D4', 'OP3:E1', 'OP2:D4', 'OP1:E3'];
  const supDe = (L) => L.supervisorId;
  const chamados = [];
  const triagensResolvidas = [];
  let id = 0;
  for (let i = 0; i < 168; i++) {
    const sub = sorteiaSub();
    const sitsValidas = sub.sits.filter((s) => !s.outros || rnd() < 0.3);
    const sit = pick(sitsValidas);
    let L, pos;
    if (rnd() < 0.28) { const [lid, p] = pick(quentes).split(':'); L = layouts.find((x) => x.id === lid); pos = p; }
    else ({ L, pos } = pick(posicoes));
    const criado = agora - int(1, 30) * DIA - int(0, 9) * 60 * MIN;
    const prioritario = ehPrioritario({ tipoPrioritario: sub.prioritario, operadorParado: !!sit.para });
    const it = sub.item ? itemNaBaia(L.id, pos, sub.item) : null;
    const tecnico = pick(['u3', 'u3', 'u4']);
    const duracaoMin = Math.max(8, Math.round((rnd() ** 1.6) * (prioritario ? 200 : 600)));
    const inicio = criado + Math.round(duracaoMin * 0.25) * MIN;
    const solucao = criado + duracaoMin * MIN;
    const fecha = solucao + int(5, 90) * MIN;
    const r = rnd();
    const status = r < 0.06 ? 'Negado' : r < 0.1 ? 'Cancelado' : 'Concluído';
    const causa = sub.item && sit.dano ? pick(['Desgaste natural', 'Desgaste natural', 'Desgaste natural', 'Defeito de fábrica', 'Problema da baia', 'Mau uso']) : sub.item ? 'Sem dano físico' : null;
    const ocup = ocupacao[`${L.id}:${pos}`]?.nome || 'Sem ocupante';
    const remetente = sub.baia === false ? 'u6' : supDe(L);
    const hist = [{ status: 'Em Análise', at: criado, just: 'Chamado registrado no sistema.', user: remetente }];
    if (status === 'Concluído') {
      hist.push({ status: 'Em Execução', at: inicio, just: 'Atendimento iniciado.', user: tecnico });
      hist.push({ status: 'Aguardando Consenso', at: solucao, just: 'Solução registrada.', user: tecnico });
      hist.push({ status: 'Concluído', at: fecha, just: 'Solicitante confirmou a solução.', user: remetente });
    } else if (status === 'Negado') hist.push({ status: 'Negado', at: inicio, just: 'Chamado duplicado.', user: tecnico });
    else hist.push({ status: 'Cancelado', at: inicio, just: 'O problema se resolveu sozinho.', user: remetente });
    const passos = sit.passos.map((t, j) => ({ texto: t, st: 'feito', at: criado - (sit.passos.length - j) * int(20, 90) * 1000 }));
    chamados.push({
      id: ++id, titulo: `${sub.nome} — ${sit.outros ? 'Outros' : sit.nome}`, catId: sub.cat.id, subId: sub.id, sitId: sit.id,
      categoria: sub.cat.nome, sub: sub.nome, situacao: sit.nome, prioritario, depto: sub.cat.equipe,
      layoutId: sub.item || sub.baia ? L.id : null, pos: sub.item || sub.baia ? pos : null, local: '',
      itens: it ? [{ assetId: it.id, tipo: it.tipo, situacao: sit.nome, sitId: sit.id }] : [],
      ocupante: sub.item || sub.baia ? ocup : '—', remetenteId: remetente, tecnicoId: tecnico, status, criadoEm: criado,
      descricao: sit.outros ? 'Problema descrito pelo supervisor.' : '', triagem: passos, alerta: null,
      outros: !!sit.outros, outrosRevisado: true, anexos: sit.dano ? ['foto-item.jpg'] : [], operadorParado: !!sit.para,
      solucao: status === 'Concluído' ? { texto: 'Atendimento realizado na baia.', causa, user: tecnico, at: solucao } : null,
      reaberturas: rnd() < 0.05 ? 1 : 0, hist,
      direcionadoEm: criado, direcionadoPor: remetente, motivoDirecionamento: 'fila'
    });
    // ~1 em cada 3 problemas com triagem é resolvido sem abrir chamado (RF06)
    if (sit.passos.length && rnd() < 0.55) {
      triagensResolvidas.push({ id: `tr${i}`, at: criado - int(1, 5) * DIA, sitId: sit.id, subId: sub.id, situacao: sit.nome, layoutId: L.id, pos, userId: remetente, passoDecisivo: pick(sit.passos) });
    }
  }

  // ---------- chamados em andamento (os mesmos do protótipo, em cima do modelo novo)
  const sitPor = (subId, nome) => catalogo.flatMap((c) => c.subs).find((s) => s.id === subId).sits.find((s) => s.nome === nome);
  const reg = (txts, inicioMin, gapSeg) => txts.map((t, j) => ({ texto: t, st: 'feito', at: agora - inicioMin * MIN + j * gapSeg * 1000 }));
  const ativo = (o) => {
    const sub = subs.find((s) => s.id === o.subId);
    const sit = sitPor(o.subId, o.sit);
    const prioritario = ehPrioritario({ tipoPrioritario: sub.prioritario, operadorParado: !!sit.para });
    const it = sub.item && o.layoutId ? itemNaBaia(o.layoutId, o.pos, sub.item) : null;
    chamados.push({
      id: ++id, titulo: `${sub.nome} — ${o.tituloSit || sit.nome}`, catId: sub.cat.id, subId: sub.id, sitId: sit.id,
      categoria: sub.cat.nome, sub: sub.nome, situacao: sit.nome, prioritario, depto: o.depto || sub.cat.equipe,
      layoutId: o.layoutId || null, pos: o.pos || null, local: o.local || '',
      itens: it ? [{ assetId: it.id, tipo: it.tipo, situacao: sit.nome, sitId: sit.id }] : [],
      ocupante: o.layoutId ? ocupacao[`${o.layoutId}:${o.pos}`]?.nome || 'Sem ocupante' : '—',
      remetenteId: o.remetente, tecnicoId: o.tecnico || null, status: o.hist[o.hist.length - 1][0], criadoEm: agora - o.hist[0][1] * MIN,
      descricao: o.descricao || '', triagem: o.triagem || [], alerta: o.alerta || null, outros: !!sit.outros, outrosRevisado: false,
      anexos: o.anexos || [], operadorParado: !!sit.para, solucao: o.solucao ? { ...o.solucao, at: agora - o.solucao.min * MIN } : null,
      reaberturas: 0,
      hist: o.hist.map(([status, m, just, user]) => ({ status, at: agora - m * MIN, just, user })),
      // Direcionamento: quando chegou para quem vai resolver (abertura ou encaminhamento).
      direcionadoEm: agora - (o.encaminhado ? o.encaminhado.min : o.hist[0][1]) * MIN,
      direcionadoPor: o.encaminhado ? o.encaminhado.por : o.remetente,
      motivoDirecionamento: o.encaminhado || o.tecnico ? 'encaminhado' : 'fila'
    });
  };
  ativo({ subId: 'b4', sit: 'Não liga', layoutId: 'OP1', pos: 'D2', remetente: 'u1', descricao: 'Operador sem conseguir trabalhar desde o início do turno.',
    triagem: reg(['Conferir se o cabo de energia está ligado', 'Conferir o cabo de rede', 'Reiniciar o computador'], 13, 0.6),
    alerta: 'Os 3 passos da triagem foram marcados em 1 segundo. Pode ser que não tenham sido realmente executados.',
    hist: [['Em Análise', 12, 'Chamado registrado no sistema.', 'u1']] });
  ativo({ subId: 'b1', sit: 'Sem áudio', layoutId: 'OP1', pos: 'E3', remetente: 'u1', tecnico: 'u3',
    triagem: [{ texto: 'Conferir se o plug está bem encaixado', st: 'feito', at: agora - 98 * MIN }, { texto: 'Trocar o headset de porta USB', st: 'feito', at: agora - 97 * MIN },
      { texto: 'Verificar o volume e o dispositivo de áudio no softphone', st: 'imposs', motivo: 'Softphone travado, não abre as configurações', at: agora - 96 * MIN }],
    hist: [['Em Análise', 95, 'Chamado registrado no sistema.', 'u1'], ['Em Execução', 70, 'Indo até a baia.', 'u3']] });
  ativo({ subId: 'b2', sit: 'Quebrado', layoutId: 'OP1', pos: 'E1', remetente: 'u1', tecnico: 'u3', descricao: 'Botão esquerdo solto.', anexos: ['mouse-op1-e1.jpg'],
    solucao: { texto: 'Mouse substituído por um novo do almoxarifado. O antigo foi para a manutenção.', causa: 'Desgaste natural', user: 'u3', min: 40 },
    hist: [['Em Análise', 300, 'Chamado registrado no sistema.', 'u1'], ['Em Execução', 120, 'Atendimento iniciado.', 'u3'], ['Aguardando Consenso', 40, 'Solução registrada.', 'u3']] });
  ativo({ subId: 'b9', sit: 'Outros', tituloSit: 'Outros: encosto da cadeira soltou', layoutId: 'OP1', pos: 'E2', remetente: 'u1',
    descricao: 'Encosto da cadeira soltou, operador trabalhando em pé.', hist: [['Em Análise', 25, 'Chamado registrado no sistema.', 'u1']] });
  ativo({ subId: 'b5', sit: 'Sem imagem', layoutId: 'DG-M1', pos: 'D4', remetente: 'u2', tecnico: 'u4',
    triagem: reg(['Conferir os cabos de energia e de vídeo', 'Apertar o botão de entrada (input) do monitor'], 185, 50),
    hist: [['Em Análise', 180, 'Chamado registrado no sistema.', 'u2'], ['Pendente', 150, 'Aguardando cabo HDMI chegar do fornecedor.', 'u4']] });
  ativo({ subId: 'b4', sit: 'Lento ou travando', layoutId: 'DG-M1', pos: 'SUB', remetente: 'u2', descricao: 'Trava ao abrir a Argus.',
    triagem: reg(['Fechar programas e abas que não estão em uso', 'Reiniciar o computador'], 290, 90),
    hist: [['Em Análise', 280, 'Chamado registrado no sistema.', 'u2']] });
  ativo({ subId: 'b1', sit: 'Microfone não capta', layoutId: 'OP3', pos: 'E1', remetente: 'u8', tecnico: 'u4',
    triagem: reg(['Verificar se o microfone está no mudo', 'Trocar o headset de porta USB'], 52, 40),
    hist: [['Em Análise', 50, 'Chamado registrado no sistema.', 'u8'], ['Em Execução', 20, 'Atendimento iniciado.', 'u4']] });
  ativo({ subId: 'b6', sit: 'Erro ao entrar', layoutId: 'OP2', pos: 'D4', remetente: 'u7', tecnico: 'u3', encaminhado: { por: 'u4', min: 8 },
    triagem: reg(['Conferir usuário e senha (caps lock)', 'Fechar e abrir a Argus novamente'], 47, 35),
    hist: [['Em Análise', 45, 'Chamado registrado no sistema.', 'u7'], ['Em Análise', 8, 'Encaminhado para Diego Lima.', 'u4']] });
  ativo({ subId: 'b11', sit: 'Novo colaborador', remetente: 'u1', depto: 'RH',
    descricao: 'Nova operadora começa segunda na Equipe 1 (baia OP1-E4): precisa de crachá, cadastro e treinamento.',
    hist: [['Em Análise', 20, 'Chamado registrado pelo formulário (destino: RH).', 'u1']] });
  ativo({ subId: 'b10', sit: 'Outros', tituloSit: 'Outros: projetor da sala 2 não liga', local: 'Sala de reunião 2', remetente: 'u6',
    descricao: 'Projetor não liga, reunião com cliente às 15h.', hist: [['Em Análise', 35, 'Chamado registrado no sistema (formulário, destino: Facilities).', 'u6']] });

  // ---------- dossiês do RH a partir de laudos "Mau uso" (RN03)
  const dossies = chamados.filter((c) => c.solucao?.causa === 'Mau uso' && c.itens.length).slice(0, 4).map((c, k) => ({
    id: `d${k + 1}`, ticketId: c.id, assetId: c.itens[0].assetId, layoutId: c.layoutId, pos: c.pos, ocupante: c.ocupante,
    criadoEm: c.solucao.at, status: k < 2 ? 'Aguardando RH' : k === 2 ? 'Procedente' : 'Improcedente',
    decisao: k < 2 ? null : { user: 'u5', at: c.solucao.at + 2 * DIA, just: k === 2 ? 'Termo assinado e fotos confirmam o dano. Encaminhado conforme o acordo.' : 'Item já tinha defeito registrado no termo de entrega.' }
  }));

  // ---------- termos de responsabilidade (RF19)
  const termos = {};
  for (const [key, oc] of Object.entries(ocupacao)) {
    if (!oc || key.endsWith(':SUP') || key.endsWith(':SUB')) continue;
    const assinado = rnd() < 0.8;
    termos[key] = { ocupante: oc.nome, geradoEm: oc.desde, assinadoEm: assinado ? oc.desde + DIA : null, versao: 1 };
  }

  // Ciência (o que cada pessoa já viu): o que chegou há mais de 1 hora já foi visto,
  // então ao entrar aparecem só os chamados recentes.
  const ciencia = {};
  for (const u of usuarios) {
    ciencia[u.id] = {};
    for (const c of chamados) if ((c.direcionadoEm ?? c.criadoEm) < agora - 60 * MIN) ciencia[u.id][c.id] = c.direcionadoEm ?? c.criadoEm;
  }

  return {
    versao: 7,
    ciencia,
    // WhatsApp das Baias (mesmo mapa do BenHermes, versão 3)
    whatsapp: seedWhatsapp(layouts, ocupacao, nomeUser, agora),
    criadoEm: agora,
    usuarios, layouts, catalogo, tipos, itens, chamados, triagensResolvidas, ocupacao, ocupHist, dossies, termos,
    seqChamado: id + 1, seqItem: seqId + 1, seqLocal,
    notificacoes: [
      { id: 'n1', at: agora - 12 * MIN, canal: 'BenHub', grupo: 'TI', texto: 'Novo chamado #2026-0169 · OP1-D2 · Computador — Não liga · prioritário', lida: false },
      { id: 'n2', at: agora - 40 * MIN, canal: 'BenHub', grupo: 'Supervisão Equipe 1', texto: '#2026-0171 aguardando sua confirmação: solução registrada por Diego Lima', lida: false },
      { id: 'n3', at: agora - 3 * 60 * MIN, canal: 'BenHub', grupo: 'TI / Administração', texto: 'Estoque mínimo: Headset com 3 disponíveis (mínimo 5)', lida: true }
    ],
    auditoria: [
      { id: 'a1', at: agora - 2 * DIA, user: 'u3', acao: 'Descarte solicitado', alvo: qHs.id, detalhe: 'Headset quebrado sem conserto' },
      { id: 'a2', at: agora - 3 * DIA, user: 'u6', acao: 'Módulo ligado', alvo: 'Termo de responsabilidade', detalhe: '' }
    ],
    tema: {
      nomeSistema: 'BenCalls', empresa: 'Benconsig', logoTexto: 'B', logoImg: '', primaria: '#0B3A82', destaque: '#F5B800',
      fonte: 'Inter', loginImg: '', loginTitulo: 'Chamado certo, na baia certa.',
      termos: { baia: 'baia', posicao: 'posição' }
    },
    modulos: { termo: true, dossie: true, benhub: true, argus: false, whatsapp: true },
    canais: [
      { id: 'e1', evento: 'Chamado aberto, mudança de status e fechamento', grupo: 'Grupo do supervisor da equipe', canal: 'BenHub', ativo: true },
      { id: 'e2', evento: 'Chamado novo e chamado prioritário', grupo: 'Grupo do TI', canal: 'BenHub', ativo: true },
      { id: 'e3', evento: 'Incidente geral detectado', grupo: 'Supervisores + TI', canal: 'BenHub', ativo: true },
      { id: 'e4', evento: 'Estoque mínimo atingido, garantia vencendo', grupo: 'TI / Administração', canal: 'BenHub', ativo: true },
      { id: 'e5', evento: 'Relatórios automáticos (diário, semanal, mensal)', grupo: 'Gestão', canal: 'E-mail', ativo: true }
    ]
  };
}
