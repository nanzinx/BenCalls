# 💬 Controle de WhatsApps: integração com o BenHermes

O **Controle de WhatsApps** nasceu no BenHermes para substituir a planilha *RELATORIO-WHATSAPP-INTUITIVO*.
No BenCalls ele fica **ligado às baias**: a mesma baia `OP1-E3` mostra os itens, os chamados e o WhatsApp dela.
O objetivo é ter mais controle dos números e facilitar a manutenção diária.

## O que dá para fazer no BenCalls

| Onde | O quê |
|---|---|
| **Menu › Controle de WhatsApps** | Mapa das mesas pintado pela situação do WhatsApp, os números grandes (OK, banidos, em análise, restringidos, perdidos) e o bloco **Atenção** com os botões do ciclo do banimento. O contador do menu mostra o que pede ação. |
| **Detalhe da baia** (qualquer mapa) | Situação do número, celular e vaga ligados, número do chip e os botões (⛔ Caiu, 📨 Pedi análise, 🟢 Liberado, ✖️ Perdido, 🔁 Troquei o chip, 🟢 Voltou). Número perdido tem o botão **Abrir chamado para trocar o chip**. |
| **Manutenção** | Manhã e almoço da operação: celular por celular, os botões, **✅ Celular conferido**, observação e o texto *REGISTRO DE MANUTENÇÃO — WHATSAPP* pronto para copiar. Se a página fechar, a manutenção continua de onde parou. |
| **Celulares** | Cada celular (cor da capinha, marca, equipe) com as vagas, quem usa, o número e a situação. |
| **Histórico** | Toda mudança de situação e de operador, com filtro, marcando o que foi feito na manutenção. |
| **BenHermes** | Exportar e importar o mapa (`.json`), ver **o que não bate** com as baias do BenCalls e corrigir com um clique. |

### Como os dois se conversam

- **Chamado ⇄ WhatsApp.** O catálogo ganhou *WhatsApp e celular › WhatsApp da baia*. Abrir um chamado
  **“WhatsApp banido”** pelo mapa já marca o número como banido no Controle de WhatsApps. Cada botão apertado
  depois (análise pedida, liberado, chip trocado…) entra no histórico do chamado aberto daquela baia.
- **Ocupante ⇄ operador.** Trocar o ocupante da baia no BenCalls troca o operador no mapa do WhatsApp
  (e grava no histórico dele, como no BenHermes).
- **Avisos.** Quando um número cai ou é perdido, a supervisão da equipe recebe o aviso (BenHub ou e-mail).
- **Quem mexe.** TI e gestão veem tudo e fazem a manutenção. O supervisor vê **só a própria equipe** e pode
  atualizar a situação dela, pela mesma regra do BenHermes (`filtrarMapaParaSupervisor`). Código de acesso: `WPP`.
- **Módulo.** Liga e desliga em *Personalização › Módulos › Controle de WhatsApps (BenHermes)*.

## Estágios do banimento e o chamado

O número passa pelos mesmos estágios do BenHermes, e o chamado de WhatsApp da baia acompanha cada um
([`src/lib/estagios-whatsapp.ts`](../src/lib/estagios-whatsapp.ts)):

| Estágio | O que é | O chamado |
|---|---|---|
| ⛔ **Banido** | O WhatsApp baniu o número. | Com o TI: pedir a análise na manutenção. |
| 🔎 **Em análise** | O próprio WhatsApp avalia o número; a resposta costuma sair **em até 1 dia** (liberado ou perdido). | **Pendente · aguardando o WhatsApp.** Sem manutenção: *Iniciar execução* e *Registrar solução* ficam travados. |
| ⏳ **Restringido** | O número **não conecta no WhatsApp Web** até o fim do prazo que o WhatsApp mostra. | **Pendente · aguardando o WhatsApp**, até o prazo acabar. |
| Restrição terminou / análise passou de 24 h | O prazo venceu sem novidade. | **Volta sozinho para o TI**, com o próximo passo (conferir o WhatsApp Web / o celular). |
| ✖️ **Perdido** | A análise foi negada; o número não volta. | Volta para o TI: **trocar o chip**. |
| 🟢 **Liberado / voltou / chip trocado** | O número funciona de novo. | **Concluído** sozinho, com a solução registrada. |

- Vale para o que é feito no BenCalls e para o que chega do BenHermes pela API.
- O catálogo tem **“WhatsApp restringido (não conecta no WhatsApp Web)”**: ao abrir, a supervisão informa por
  quanto tempo (o WhatsApp mostra no celular) e a baia já fica restringida até lá.
- No chamado, uma linha do tempo mostra o estágio, a previsão (resposta da análise ou fim da restrição) e o
  próximo passo. No *Controle de WhatsApps*, o bloco **Aguardando o WhatsApp** lista esses números com os prazos.

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

- **BenHermes → BenCalls:** no BenHermes, *Exportar mapa*; no BenCalls, *Controle de WhatsApps › BenHermes ›
  Importar mapa do BenHermes*. A prévia mostra salas, celulares e o que não bate com as baias daqui.
- **BenCalls → BenHermes:** *Exportar mapa (.json)* aqui e *Importar mapa* lá.

Situações, celulares, histórico (12 meses) e manutenções vão juntos. As mesas são casadas pela **sigla**
(`OP1`, `DG-M1`), que é a base do código da baia nos dois sistemas.

## Tempo real: API de integração

Além do arquivo, os dois conversam sozinhos por uma **API de eventos assinados**: quando a manutenção é salva
no BenHermes, o BenCalls deixa o WhatsApp da baia OK e **conclui o chamado** daquela baia; os chamados de
WhatsApp abertos no BenCalls aparecem no BenHermes. Como ligar, os eventos e a segurança:
[`API-INTEGRACAO.md`](API-INTEGRACAO.md).
