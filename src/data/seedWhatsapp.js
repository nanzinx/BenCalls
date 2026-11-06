// Controle de WhatsApps da demonstração: o mesmo mapa do BenHermes (versão 3), montado a partir das
// mesas do BenCalls, com celulares, situações do ciclo do banimento, histórico e manutenções.
// Cada mudança passa pelas funções do BenHermes, então o histórico sai igual ao de lá.
import { HORA, DIA, MIN } from '../lib/format.ts';
import { mapaDasMesas, acharMesa } from '../lib/whatsapp-baias.ts';
import { novoCelular, adicionarCelularNoMapa, alterarCelularNoMapa } from '../lib/benhermes/celulares.ts';
import { alterarLugarNoMapa } from '../lib/benhermes/whatsappBaias.ts';
import { gravarAlteracao } from '../lib/benhermes/whatsappHistorico.ts';
import { aplicarAcao, iniciarManutencao, alternarConferido, concluirManutencao, etapasDaManutencao } from '../lib/benhermes/whatsappManutencao.ts';

const CELULARES = [
  { mesa: 'OP1', cor: 'Azul', hex: '#2563eb', marca: 'SAMSUNG' },
  { mesa: 'OP2', cor: 'Vermelho', hex: '#dc2626', marca: 'SAMSUNG' },
  { mesa: 'OP3', cor: 'Verde', hex: '#16a34a', marca: 'MOTOROLA', usuarios: 2 },
  { mesa: 'OP4', cor: 'Preto', hex: '#1f2937', marca: 'XIAOMI', usuarios: 3 },
  { mesa: 'OP5', cor: 'Rosa', hex: '#db2777', marca: 'SAMSUNG' },
  { mesa: 'DG-M1', cor: 'Branco', hex: '#e5e7eb', marca: 'MOTOROLA', usuarios: 1, compartilhado: true }
];

// Números de chip fictícios (formato de celular de SP)
const numero = (i) => `(11) 9${String(8100 + i * 37).padStart(4, '0')}-${String(1000 + ((i * 7919) % 9000)).padStart(4, '0')}`;

export function seedWhatsapp(layouts, ocupacao, nomeUser, agora) {
  const quando = (msAtras) => new Date(agora - msAtras);
  let m = mapaDasMesas(layouts, ocupacao, (id) => nomeUser[id] || '', quando(21 * DIA));
  m.inicioDoHistorico = quando(21 * DIA).toISOString();

  // Celulares (as vagas se ligam sozinhas às baias: Messenger à esquerda, Business à direita)
  let n = 0;
  for (const c of CELULARES) {
    const t = quando(21 * DIA - MIN);
    const mesa = acharMesa(m, c.mesa)?.mesa;
    let cel = novoCelular({ cor: c.cor, hex: c.hex, apelido: '', marca: c.marca, usuarios: c.usuarios || 1, mesaId: mesa?.id ?? null }, m, t);
    if (c.compartilhado) cel = { ...cel, compartilhado: true, nomeBackup: 'Digital Benconsig', vagas: cel.vagas.map((v) => ({ ...v, baia: null })) };
    cel = { ...cel, vagas: cel.vagas.map((v) => ({ ...v, numero: numero(++n) })) };
    m = adicionarCelularNoMapa(m, cel, t);
  }

  const passo = (msAtras, mudar) => {
    const d = quando(msAtras);
    const antes = m;
    m = gravarAlteracao(antes, mudar(antes, d), d);
  };
  const alvo = (sigla, posicao) => {
    const { sala, mesa } = acharMesa(m, sigla);
    return { tipo: 'lugar', salaId: sala.id, mesaId: mesa.id, posicao };
  };
  const acao = (msAtras, sigla, pos, a, extra) => passo(msAtras, (mm, d) => aplicarAcao(mm, alvo(sigla, pos), a, d, extra));

  // Quedas antigas que voltaram (alimentam o histórico e as estatísticas)
  const antigas = [
    ['OP1', 'E3', 18], ['OP2', 'D1', 16], ['OP4', 'E2', 14], ['OP1', 'E3', 11], ['OP5', 'D3', 9], ['OP3', 'E4', 6], ['OP2', 'E1', 4]
  ];
  for (const [s, p, dias] of antigas) {
    acao(dias * DIA, s, p, 'BANIDO');
    acao(dias * DIA - 40 * MIN, s, p, 'PEDIU_ANALISE');
    acao(dias * DIA - 20 * HORA, s, p, 'LIBERADO');
  }

  // Um operador antigo que ficou no mapa do WhatsApp: aparece em "O que não bate"
  passo(3 * DIA, (mm, d) => {
    const { sala, mesa } = acharMesa(mm, 'OP3');
    return alterarLugarNoMapa(mm, sala.id, mesa.id, 'D3', { operador: 'WESLEY MORAES' }, d);
  });

  // Manutenção já concluída: abre, registra o que aconteceu, confere os celulares e gera o texto
  const manutencao = (msAtras, acoes, obs) => {
    passo(msAtras, (mm, d) => iniciarManutencao(mm, d));
    for (const [min, s, p, a] of acoes) acao(msAtras - min * MIN, s, p, a);
    const etapas = etapasDaManutencao(m);
    etapas.forEach((e, i) => passo(msAtras - (12 + i * 3) * MIN, (mm) => alternarConferido(mm, e.id)));
    passo(msAtras - 36 * MIN, (mm, d) => concluirManutencao(mm, obs, d).mapa);
  };

  // Manutenções de anteontem, na manhã (9:10) e no almoço da operação (12:40)
  const anteontem = (h, mi) => { const d = new Date(agora); d.setDate(d.getDate() - 2); d.setHours(h, mi, 0, 0); return agora - d.getTime(); };
  manutencao(anteontem(9, 10), [[8, 'OP2', 'D4', 'BANIDO'], [9, 'OP2', 'D4', 'PEDIU_ANALISE']], '');
  manutencao(anteontem(12, 40), [[6, 'OP3', 'D2', 'BANIDO'], [7, 'OP3', 'D2', 'PEDIU_ANALISE'], [10, 'OP3', 'D2', 'LIBERADO']], 'Celular Verde com a bateria fraca.');

  // Como está agora (em ordem de tempo, para o histórico ficar na ordem certa)
  acao(30 * HORA, 'OP1', 'D2', 'BANIDO');
  acao(29 * HORA, 'OP1', 'D2', 'PEDIU_ANALISE'); // vira análise atrasada (mais de 24 h)
  acao(25 * HORA, 'OP5', 'E2', 'RESTRINGIDO', { restricao: { quantidade: 24, unidade: 'horas' } }); // venceu há 1 h
  acao(20 * HORA, 'OP2', 'D4', 'PERDIDO'); // análise negada: número perdido, trocar o chip
  acao(5 * HORA, 'OP4', 'D1', 'RESTRINGIDO', { restricao: { quantidade: 2, unidade: 'dias' } });
  acao(3 * HORA, 'OP2', 'E3', 'BANIDO'); // falta pedir a análise
  acao(2 * HORA + 10 * MIN, 'OP3', 'E1', 'BANIDO');
  acao(2 * HORA, 'OP3', 'E1', 'PEDIU_ANALISE'); // análise dentro das 24 h
  // Uma vaga de backup do celular da Digital caiu
  passo(50 * MIN, (mm, d) => {
    const cel = mm.celulares.find((c) => c.compartilhado);
    return alterarCelularNoMapa(mm, cel.id, (c) => ({ ...c, vagas: c.vagas.map((v, i) => (i === 1 ? { ...v, whatsapp: { situacao: 'BANIDO', mudouEm: d.toISOString() } } : v)) }), d);
  });

  m.atualizadoEm = new Date(agora).toISOString();
  return m;
}
