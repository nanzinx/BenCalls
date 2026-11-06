# 💬 WhatsApp das Baias: integração com o BenHermes

O **WhatsApp das Baias** nasceu no BenHermes para substituir a planilha *RELATORIO-WHATSAPP-INTUITIVO*.
No BenCalls ele fica **ligado às baias**: a mesma baia `OP1-E3` mostra os itens, os chamados e o WhatsApp dela.
O objetivo é ter mais controle dos números e facilitar a manutenção diária.

## O que dá para fazer no BenCalls

| Onde | O quê |
|---|---|
| **Menu › WhatsApp das Baias** | Mapa das mesas pintado pela situação do WhatsApp, os números grandes (OK, banidos, em análise, restringidos, perdidos) e o bloco **Atenção** com os botões do ciclo do banimento. O contador do menu mostra o que pede ação. |
| **Detalhe da baia** (qualquer mapa) | Situação do número, celular e vaga ligados, número do chip e os botões (⛔ Caiu, 📨 Pedi análise, 🟢 Liberado, ✖️ Perdido, 🔁 Troquei o chip, 🟢 Voltou). Número perdido tem o botão **Abrir chamado para trocar o chip**. |
| **Manutenção** | Manhã e almoço da operação: celular por celular, os botões, **✅ Celular conferido**, observação e o texto *REGISTRO DE MANUTENÇÃO — WHATSAPP* pronto para copiar. Se a página fechar, a manutenção continua de onde parou. |
| **Celulares** | Cada celular (cor da capinha, marca, equipe) com as vagas, quem usa, o número e a situação. |
| **Histórico** | Toda mudança de situação e de operador, com filtro, marcando o que foi feito na manutenção. |
| **BenHermes** | Exportar e importar o mapa (`.json`), ver **o que não bate** com as baias do BenCalls e corrigir com um clique. |

### Como os dois se conversam

- **Chamado ⇄ WhatsApp.** O catálogo ganhou *WhatsApp e celular › WhatsApp da baia*. Abrir um chamado
  **“WhatsApp banido”** pelo mapa já marca o número como banido no WhatsApp das Baias. Cada botão apertado
  depois (análise pedida, liberado, chip trocado…) entra no histórico do chamado aberto daquela baia.
- **Ocupante ⇄ operador.** Trocar o ocupante da baia no BenCalls troca o operador no mapa do WhatsApp
  (e grava no histórico dele, como no BenHermes).
- **Avisos.** Quando um número cai ou é perdido, a supervisão da equipe recebe o aviso (BenHub ou e-mail).
- **Quem mexe.** TI e gestão veem tudo e fazem a manutenção. O supervisor vê **só a própria equipe** e pode
  atualizar a situação dela, pela mesma regra do BenHermes (`filtrarMapaParaSupervisor`). Código de acesso: `WPP`.
- **Módulo.** Liga e desliga em *Personalização › Módulos › WhatsApp das Baias (BenHermes)*.

## As regras são as do BenHermes, sem cópia manual

As regras ficam em [`src/lib/benhermes/`](../src/lib/benhermes) e **vêm do BenHermes por um script**, sem
nenhuma linha reescrita. Assim, as situações, o ciclo do banimento, as vagas de cada marca de celular, o histórico,
a manutenção e o texto do grupo funcionam igual nos dois sistemas.

```bash
npm run benhermes:sincronizar -- ../BENHERMES
```

O script:

1. copia os tipos e os módulos puros (`mapaMesas`, `whatsappBaias`, `celulares`, `whatsappAlertas`,
   `whatsappHistorico`, `whatsappManutencao`);
2. copia **os testes do BenHermes** para [`tests/benhermes/`](../tests/benhermes), que rodam aqui no `npm test`
   (com um `vitest` mínimo por cima do `node:test`);
3. ajusta só os imports (extensão `.ts` e `import type`) e anota o commit de origem.

Se um teste do BenHermes falhar aqui, a regra mudou lá e algo daqui precisa acompanhar.
A ponte entre os dois lados (achar a mesa pela sigla, montar o mapa a partir das mesas, comparar ocupantes)
fica em [`src/lib/whatsapp-baias.ts`](../src/lib/whatsapp-baias.ts), com testes em
[`tests/whatsapp-baias.test.ts`](../tests/whatsapp-baias.test.ts).

## O mesmo arquivo nos dois

O mapa é o `.json` **versão 3** do BenHermes (`tipo: benhermes-whatsapp-baias`):

- **BenHermes → BenCalls:** no BenHermes, *Exportar mapa*; no BenCalls, *WhatsApp das Baias › BenHermes ›
  Importar mapa do BenHermes*. A prévia mostra salas, celulares e o que não bate com as baias daqui.
- **BenCalls → BenHermes:** *Exportar mapa (.json)* aqui e *Importar mapa* lá.

Situações, celulares, histórico (12 meses) e manutenções vão juntos. As mesas são casadas pela **sigla**
(`OP1`, `DG-M1`), que é a base do código da baia nos dois sistemas.

## Ligação direta (versão com servidor)

Na demonstração o mapa fica no navegador. Com servidor, os dois leem e gravam o **mesmo mapa** e a manutenção
feita num aparece no outro na hora. O BenHermes já tem a API:

| Método | Caminho | O que faz |
|---|---|---|
| `GET` | `/api/whatsapp` | `{ mapa }` (operador recebe 403) |
| `PUT` | `/api/whatsapp` | grava `{ mapa }`; supervisor só altera a própria mesa (`validateWhatsappPermissions`) |

Para o BenCalls usar essa API:

1. **Mesmo domínio** (recomendado): publicar o BenHermes em `/benhermes` atrás do mesmo Cloudflare Tunnel, para o
   cookie de sessão (`HttpOnly; SameSite=Lax`) valer nas duas telas. Sem domínio comum, o BenHermes precisa liberar
   CORS para o endereço do BenCalls ou aceitar um token de serviço.
2. **Usuários:** o login do BenCalls e o do BenHermes devem apontar para a mesma pessoa (o `supervisorUserId` da
   mesa é o id do usuário).
3. No [`src/store/store.jsx`](../src/store/store.jsx), as ações `whatsappAcao`, `whatsappMudar` e
   `whatsappSubstituir` passam a fazer `PUT /api/whatsapp` com o mapa novo, e o carregamento faz `GET /api/whatsapp`.
   As regras continuam rodando no navegador (são as mesmas dos dois lados); o servidor confere as permissões.
4. Para duas pessoas mexendo ao mesmo tempo, vale gravar só o que mudou (ou conferir `atualizadoEm` antes do
   `PUT`) para uma não sobrescrever a outra. Hoje o BenHermes grava o mapa inteiro.
