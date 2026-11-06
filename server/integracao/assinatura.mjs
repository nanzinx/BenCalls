// Assinatura das mensagens entre o BenHermes e o BenCalls (HMAC-SHA256 com um segredo combinado).
//
//   X-Integracao-Origem:     benhermes | bencalls
//   X-Integracao-Tempo:      1762450000000            (milissegundos desde 1970)
//   X-Integracao-Assinatura: sha256=<hex>             HMAC(segredo, `${tempo}.${corpo}`)
//
// O tempo entra na conta para que uma mensagem copiada não possa ser reenviada depois
// (só vale dentro da janela de 5 minutos); o corpo é o texto exato que foi enviado.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const JANELA_MS = 5 * 60_000;
export const TAMANHO_MINIMO_SEGREDO = 32;

export function assinar(segredo, tempo, corpo) {
  return 'sha256=' + createHmac('sha256', segredo).update(`${tempo}.${corpo}`).digest('hex');
}

/** Confere a assinatura. Devolve null se estiver tudo certo, ou o motivo da recusa. */
export function conferir({ segredo, tempo, assinatura, corpo, agora = Date.now(), janela = JANELA_MS }) {
  const t = Number(tempo);
  if (!Number.isFinite(t) || !/^\d{10,16}$/.test(String(tempo))) return 'tempo ausente ou inválido';
  if (Math.abs(agora - t) > janela) return 'mensagem fora da janela de 5 minutos (relógio errado ou reenvio)';
  if (typeof assinatura !== 'string' || !/^sha256=[0-9a-f]{64}$/.test(assinatura)) return 'assinatura ausente ou mal formada';
  const esperada = Buffer.from(assinar(segredo, String(tempo), corpo));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return 'assinatura não confere';
  return null;
}
