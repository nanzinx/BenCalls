// Envia eventos assinados para o outro sistema (BenCalls → BenHermes, ou um teste para o próprio
// BenCalls). Usado pelo script scripts/integracao-enviar.mjs e, quando a BenApi existir, por ela
// ao abrir um chamado de WhatsApp (o envio precisa sair de um servidor com login, nunca do navegador).
import { assinar } from './assinatura.mjs';

export async function enviarEventos({ url, segredo, eventos, origem = 'bencalls', fetchImpl = fetch, agora = Date.now, tentativas = 3, espera = 1000 }) {
  const corpo = JSON.stringify({ eventos });
  let ultimo = null;
  for (let i = 0; i < tentativas; i++) {
    const tempo = String(agora());
    try {
      const r = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integracao-Origem': origem,
          'X-Integracao-Tempo': tempo,
          'X-Integracao-Assinatura': assinar(segredo, tempo, corpo)
        },
        body: corpo
      });
      const resposta = await r.json().catch(() => ({}));
      ultimo = { ok: r.ok, status: r.status, resposta };
      // 4xx é erro de quem mandou (assinatura, formato): tentar de novo não resolve.
      if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429)) return ultimo;
    } catch (e) {
      ultimo = { ok: false, status: 0, resposta: { erro: e.message } };
    }
    if (i < tentativas - 1) await new Promise((ok) => setTimeout(ok, espera * 2 ** i));
  }
  return ultimo;
}
