#!/usr/bin/env node
// Manda um evento assinado para a API de integração, para testar sem o BenHermes.
//
//   BENHERMES_SEGREDO=<o mesmo do servidor> node scripts/integracao-enviar.mjs --liberar OP1-E3
//   BENHERMES_SEGREDO=... node scripts/integracao-enviar.mjs --arquivo eventos.json --url https://chamados.benconsig.com
//
// --liberar <baia>   simula a manutenção do BenHermes marcando a baia como "Liberado" (volta a OK)
// --banir <baia>     simula o número da baia caindo
// --arquivo <json>   manda os eventos de um arquivo ({ "eventos": [...] })
// --url <origem>     endereço do BenCalls (padrão http://localhost:8080)
//
// No outro sentido (BenCalls → BenHermes), para testar o recebimento no BenHermes:
//   BENHERMES_SEGREDO=... node scripts/integracao-enviar.mjs --chamado OP1-E3 --numero 2026-0179 --url http://localhost:3000
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { enviarEventos } from '../server/integracao/emissor.mjs';

const args = process.argv.slice(2);
const opc = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : undefined; };
const segredo = (process.env.BENHERMES_SEGREDO || '').trim();
if (!segredo) { console.error('Defina BENHERMES_SEGREDO (o mesmo configurado no servidor do BenCalls).'); process.exit(1); }

const base = (opc('--url') || 'http://localhost:8080').replace(/\/$/, '');
const agora = new Date().toISOString();
const situacao = (codigo, de, para, acao) => ({
  id: `teste:${randomUUID()}`, tipo: 'whatsapp.situacao', em: agora,
  dados: { codigo, de, para, acao, estado: { situacao: para, mudouEm: agora }, manutencao: { id: 'teste', janela: 'MANHA' } }
});

let eventos;
let caminho = '/api/integracoes/benhermes/eventos';
let origem = 'benhermes';
if (opc('--chamado')) {
  caminho = '/api/integracoes/bencalls/eventos';
  origem = 'bencalls';
  const numero = opc('--numero') || '2026-0001';
  const id = Number(numero.split('-')[1]) || 1;
  eventos = [{ id: `teste:${randomUUID()}`, tipo: 'chamado.whatsapp', em: agora,
    dados: { chamado: { id, numero: `#${numero}` }, codigo: opc('--chamado'), situacao: 'WhatsApp banido', whatsapp: 'BANIDO', status: opc('--status') || 'aberto' } }];
} else if (opc('--arquivo')) eventos = JSON.parse(readFileSync(opc('--arquivo'), 'utf8')).eventos;
else if (opc('--liberar')) eventos = [situacao(opc('--liberar'), 'ANALISE', 'OK', 'LIBERADO')];
else if (opc('--banir')) eventos = [situacao(opc('--banir'), 'OK', 'BANIDO', 'BANIDO')];
else { console.error('Use --liberar <baia>, --banir <baia>, --chamado <baia> ou --arquivo <json>.'); process.exit(1); }

const r = await enviarEventos({ url: `${base}${caminho}`, segredo, eventos, origem, tentativas: 1 });
console.log(r.status, JSON.stringify(r.resposta));
process.exit(r.ok ? 0 : 1);
