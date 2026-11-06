# 🔌 API de integração BenHermes ⇄ BenCalls (versão 1)

Os dois sistemas conversam por **eventos assinados**. Exemplo do dia a dia:

1. A supervisora abre no BenCalls o chamado **“WhatsApp banido”** na baia `OP1-E3`.
2. O chamado aparece no BenHermes, em *Controle de WhatsApps › Chamados do BenCalls*.
3. Na manutenção, o TI marca no BenHermes **📨 Pedi análise** e depois **🟢 Liberado**.
4. O BenHermes avisa o BenCalls na hora: lá o WhatsApp de `OP1-E3` fica **OK** e o chamado é
   **concluído** (“Resolvido no BenHermes: liberado na manutenção (manhã)”), com aviso para a supervisão.

```
 BenHermes                                              BenCalls
 ─────────                                              ────────
 salvar o mapa (PUT /api/whatsapp)
   └─ eventos do que mudou ──── POST /api/integracoes/benhermes/eventos ──▶ guarda
      (fila: se o BenCalls estiver fora,                                    │
       reenvia a cada minuto)                     o site busca a cada 15 s ◀┘
                                                  → WhatsApp OK + chamado concluído

 Chamados do BenCalls ◀── POST /api/integracoes/bencalls/eventos ─────── chamado de WhatsApp
 (lista no Controle de WhatsApps)                                           aberto/concluído
```

## Segurança

| | |
|---|---|
| **Assinatura** | Toda mensagem leva `X-Integracao-Tempo` (ms) e `X-Integracao-Assinatura: sha256=<hex>`, o HMAC-SHA256 de `"<tempo>.<corpo>"` com o **segredo combinado**. Sem assinatura certa: `401`. |
| **Reenvio** | Mensagens com mais de 5 minutos de diferença são recusadas (protege contra cópia e reenvio). Os relógios dos servidores precisam estar certos (NTP). |
| **Repetidos** | Cada evento tem um `id` fixo para a mesma mudança; o mesmo id duas vezes é ignorado (`duplicados` na resposta). Reenviar é seguro. |
| **Formato** | Cada campo é conferido (`422` com o motivo); no máximo 100 eventos e 64 KB por mensagem (`413`). |
| **Dados mínimos** | O que o site do BenCalls lê (`GET`) não tem nome de operador nem número de chip: só baia, situação e manutenção. |
| **Rede** | O BenHermes só aceita os IPs de `ALLOWED_IPS`: inclua o IP de saída do servidor do BenCalls. O BenCalls só aceita os IPs de `server/ips-liberados.txt` (ou `IPS_LIBERADOS`): o IP de saída do servidor do BenHermes **precisa** estar lá. |

## Como ligar

1. Gere **um** segredo e use o mesmo nos dois:

   ```bash
   openssl rand -hex 32
   ```

2. **BenCalls** (Docker): salve o segredo em `deploy/benhermes_segredo.txt` (fora do Git), deixe o arquivo
   legível só para o usuário do container e suba de novo:

   ```bash
   printf '%s' '<segredo>' > deploy/benhermes_segredo.txt
   ```

   ```bash
   sudo chown 1000:1000 deploy/benhermes_segredo.txt && sudo chmod 400 deploy/benhermes_segredo.txt
   ```

   ```bash
   ./deploy/deploy.sh
   ```

   Fora do Docker: `BENHERMES_SEGREDO=<segredo>` e, de preferência, `DADOS_DIR=<pasta gravável>`.
3. **BenHermes**: `BENCALLS_URL=https://chamados.benconsig.com` e `BENCALLS_SEGREDO=<segredo>`
   (ou `BENCALLS_SEGREDO_ARQUIVO`). Reinicie. O log mostra `Integração BenCalls: envio ligado · recebimento ligado`.
4. Confira: no BenCalls, *Controle de WhatsApps › BenHermes* mostra **Ligada**; no BenHermes,
   `GET /api/integracoes/bencalls/status` (Admin) mostra `pendentes: 0` e o último envio.

Para testar sem o BenHermes (manda um evento assinado para o BenCalls):

```bash
BENHERMES_SEGREDO=<segredo> node scripts/integracao-enviar.mjs --liberar OP1-E3 --url http://localhost:8080
```

E o outro sentido (um chamado de WhatsApp chegando no BenHermes):

```bash
BENHERMES_SEGREDO=<segredo> node scripts/integracao-enviar.mjs --chamado OP1-E3 --numero 2026-0179 --url http://localhost:3000
```

## No BenCalls

| Método | Caminho | |
|---|---|---|
| `POST` | `/api/integracoes/benhermes/eventos` | Recebe os eventos do BenHermes (assinados). `202 { recebidos, duplicados }` |
| `GET` | `/api/integracoes/benhermes/eventos?desde=<ms>` | O site busca o que chegou depois de `desde`. `{ eventos, cursor }` |
| `GET` | `/api/integracoes/benhermes/status` | `{ ativa, versao }` |

Sem segredo configurado, as rotas respondem `503` e o site não busca nada.
Os eventos ficam em `DADOS_DIR/benhermes-eventos.jsonl` (vale entre os processos do pm2 e reinícios; gira em 5 MB).

**O que o BenCalls faz com cada evento** ([`src/lib/integracao-benhermes.ts`](../src/lib/integracao-benhermes.ts)):

- `whatsapp.situacao`: atualiza o WhatsApp da baia (vale a mudança **mais recente**: se a baia mudou no BenCalls
  depois, fica a daqui) e grava no histórico. Se o número voltou a **OK** (liberado, chip trocado, restrição terminou),
  **conclui** os chamados de WhatsApp abertos naquela baia (situações do catálogo marcadas com `whatsapp`,
  como “WhatsApp banido” e “Número perdido”). Número que caiu ou foi perdido avisa a supervisão da equipe.
- `manutencao.concluida`: avisa o grupo do TI (“Manutenção da manhã concluída no BenHermes: 6 celulares, 3 ações”).

Tudo aparece em *Controle de WhatsApps › BenHermes › Últimos eventos recebidos*, que também tem um botão para
**simular** o evento de liberação (demonstração).

## No BenHermes

| Método | Caminho | |
|---|---|---|
| `POST` | `/api/integracoes/bencalls/eventos` | Recebe os chamados de WhatsApp do BenCalls (assinados, sem login). `202 { recebidos, duplicados }` |
| `GET` | `/api/integracoes/bencalls/chamados` | Chamados abertos para as mesas que a pessoa cuida (login; supervisor vê só a própria mesa) |
| `POST` | `/api/integracoes/bencalls/chamados/<id>/dispensar` | Tira um chamado da lista (ele continua no BenCalls) |
| `GET` | `/api/integracoes/bencalls/status` | Admin: envio/recebimento ligados, eventos na fila, último envio e último erro |

O envio acontece quando o mapa é salvo (`PUT /api/whatsapp`): o BenHermes compara o mapa antes e depois
(pelo histórico que ele mesmo grava) e manda as mudanças de situação das baias e as manutenções concluídas.
O primeiro mapa e o histórico antigo de uma importação não são enviados.

## Os eventos

**BenHermes → BenCalls: `whatsapp.situacao`**

```json
{
  "id": "wpp:OP1-E3:2026-11-06T12:15:00.000Z:OK",
  "tipo": "whatsapp.situacao",
  "em": "2026-11-06T12:15:00.000Z",
  "dados": {
    "codigo": "OP1-E3",
    "de": "ANALISE",
    "para": "OK",
    "acao": "LIBERADO",
    "estado": { "situacao": "OK", "mudouEm": "2026-11-06T12:15:00.000Z" },
    "operador": "CAMILA PIRES",
    "manutencao": { "id": "6f1c…", "janela": "MANHA" }
  }
}
```

- `de`/`para`/`estado.situacao`: `OK`, `BANIDO`, `ANALISE`, `PERMANENTE`, `RESTRINGIDO`, `NAO_TEM`.
- `acao`: `BANIDO`, `RESTRINGIDO`, `PEDIU_ANALISE`, `LIBERADO`, `PERDIDO`, `TROCOU_CHIP`, `VOLTOU`.
- `estado` pode ter `analisePedidaEm` e `restritoAte`; `numeroNovo` vem quando o chip foi trocado com número anotado.

**BenHermes → BenCalls: `manutencao.concluida`**

```json
{
  "id": "manut:6f1c…",
  "tipo": "manutencao.concluida",
  "em": "2026-11-06T12:40:00.000Z",
  "dados": { "id": "6f1c…", "inicio": "…", "fim": "…", "janela": "MANHA", "conferidos": 6,
             "acoes": [{ "acao": "LIBERADO", "codigo": "OP1-E3" }], "texto": "🔧 *REGISTRO DE MANUTENÇÃO — WHATSAPP* …" }
}
```

**BenCalls → BenHermes: `chamado.whatsapp`**

```json
{
  "id": "chamado:179:aberto",
  "tipo": "chamado.whatsapp",
  "em": "2026-11-06T10:02:00.000Z",
  "dados": { "chamado": { "id": 179, "numero": "#2026-0179" }, "codigo": "OP1-E3",
             "situacao": "WhatsApp banido", "whatsapp": "BANIDO", "status": "aberto" }
}
```

`status`: `aberto`, `concluido` ou `cancelado` (concluído/cancelado tira o chamado da lista do BenHermes).
No BenHermes, **⛔ Marcar como banido** aplica a situação pelo próprio site, com as regras e o histórico de lá.

> **Quem manda o `chamado.whatsapp`?** Precisa sair de um servidor com login, nunca do navegador (senão
> qualquer um poderia mandar). Na versão com a BenApi, ela chama
> [`server/integracao/emissor.mjs`](../server/integracao/emissor.mjs) ao abrir e ao fechar um chamado de WhatsApp.
> No modo demonstração o BenCalls não tem servidor de dados, então use o script acima para testar.

## Testes

- BenCalls: [`tests/integracao.test.mjs`](../tests/integracao.test.mjs) (assinatura, formato, API, arquivo),
  [`tests/integracao-benhermes.test.ts`](../tests/integracao-benhermes.test.ts) (WhatsApp OK e chamado concluído)
  e o **contrato**: [`tests/fixtures/eventos-benhermes.json`](../tests/fixtures/eventos-benhermes.json) são eventos
  gerados pelo próprio BenHermes numa manutenção, e precisam passar aqui.
- BenHermes: `server/integracaoBenCalls.test.ts` (eventos da manutenção, fila de reenvio, recebimento, lista por mesa).
