// Onde ficam os eventos recebidos do BenHermes até o BenCalls aplicar.
// Um arquivo .jsonl (uma linha por evento) para valer entre os processos do pm2 e sobreviver a
// reinícios; sem arquivo configurado, fica só na memória (bom para testes e "npm run dev").
// Cada linha: { "recebidoEm": 1762450000000, "evento": { ...versão enxuta } }
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { enxugar } from './protocolo.mjs';

export function criarFila({ arquivo = null, maxBytes = 5 * 1024 * 1024 } = {}) {
  const memoria = [];
  let tamanhoLido = -1;
  let ids = new Set();

  if (arquivo) mkdirSync(dirname(arquivo), { recursive: true });

  const lerTudo = () => {
    if (!arquivo) return memoria;
    if (!existsSync(arquivo)) return [];
    const out = [];
    for (const linha of readFileSync(arquivo, 'utf8').split('\n')) {
      if (!linha) continue;
      try { out.push(JSON.parse(linha)); } catch { /* linha cortada: ignora */ }
    }
    return out;
  };
  // Os ids já recebidos (outro processo do pm2 pode ter gravado): relê quando o arquivo muda.
  const atualizarIds = () => {
    if (!arquivo) return;
    const t = existsSync(arquivo) ? statSync(arquivo).size : 0;
    if (t === tamanhoLido) return;
    tamanhoLido = t;
    ids = new Set(lerTudo().map((l) => l.evento.id));
  };

  return {
    /** Guarda os eventos novos; repetidos (mesmo id) são ignorados. */
    adicionar(eventos, recebidoEm = Date.now()) {
      atualizarIds();
      let novos = 0;
      let duplicados = 0;
      const linhas = [];
      for (const ev of eventos) {
        if (ids.has(ev.id)) { duplicados++; continue; }
        ids.add(ev.id);
        const linha = { recebidoEm, evento: enxugar(ev) };
        linhas.push(linha);
        novos++;
      }
      if (linhas.length) {
        if (arquivo) {
          if (existsSync(arquivo) && statSync(arquivo).size > maxBytes) renameSync(arquivo, `${arquivo}.1`); // gira o arquivo
          appendFileSync(arquivo, linhas.map((l) => JSON.stringify(l)).join('\n') + '\n', { mode: 0o600 });
          tamanhoLido = -1;
        } else {
          memoria.push(...linhas);
          if (memoria.length > 5000) memoria.splice(0, memoria.length - 5000);
        }
      }
      return { novos, duplicados };
    },
    /** Eventos recebidos depois de `desde` (ms), do mais antigo para o mais novo. */
    depois(desde = 0, limite = 200) {
      const lista = lerTudo().filter((l) => l.recebidoEm > desde).slice(0, limite);
      return {
        eventos: lista.map((l) => ({ ...l.evento, recebidoEm: l.recebidoEm })),
        cursor: lista.length ? lista[lista.length - 1].recebidoEm : desde
      };
    }
  };
}
