# O que mudou em relação ao protótipo

O protótipo v2 (login e perfis) cobria Meus chamados, Novo chamado pelo mapa, Painel do TI, Estoque, Dashboard,
Usuários, Catálogo e Espaços com três perfis. Esta versão implementa o escopo inteiro e acrescenta melhorias.

## Polimento do que já existia

- **Design system próprio** (tokens, botões, chips, tabelas, modais, gavetas) no lugar dos estilos inline, com
  foco visível em amarelo, alvos de toque ≥ 40 px e **modo escuro**.
- **Tema aplicado de verdade**: cores, fonte, logo e imagem de login vêm da configuração (RF36) e o contraste é
  validado com WCAG (RF37) — se a cor principal ficar ilegível como texto, o tom é escurecido automaticamente.
- **Assinatura Benconsig fixa** (faixa amarela + selo no rodapé e no login), que a personalização não remove (RN10).
- **Etiqueta sempre calculada** a partir do layout + posição + item; o histórico fica no ID interno. Mudar o padrão
  da mesa recalcula todas as etiquetas sem perder nada (RN12). Itens repetidos na baia viram `MN1`/`MN2`.
- **Prioridade simples:** o chamado é prioritário ou normal, sem prazo de conclusão. Nasce prioritário quando o
  tipo está marcado assim no catálogo ou quando o operador fica parado; o TI pode marcar ou tirar.
- **Painel do TI** com quadro e lista, filtros (prioritários, departamento, comigo, operador parado,
  alerta de triagem, “Outros”) e KPIs clicáveis.
- **Mobile**: menu vira gaveta, o mapa cabe na tela e, ao tocar na baia, a tela rola até os itens.

## Escopo que o protótipo ainda não tinha

- Solução com **laudo obrigatório** (RN02) e **troca de item** no mesmo passo: o item retirado vai para
  manutenção/garantia/quebrado, o substituto sai do almoxarifado e as etiquetas são geradas (RF16).
- **Dossiê do RH** automático no laudo “mau uso”, com decisão procedente/improcedente (RF20/21, RN03).
- **Termo de responsabilidade** por baia com aceite digital (RF19); nova ocupação gera termo novo.
- **Ocupação por turno** e histórico completo da baia: chamados, trocas e ocupantes (RF02, RF17).
- **Mapa geral** de todas as salas (RF33), com as equipes do operacional na ordem física.
- **Revisão de “Outros”**: reclassificar ou promover o texto a situação oficial; relatório de palavras frequentes (RF46/48).
- **Incidente geral**: 3+ chamados da mesma situação em 1 hora geram aviso de “problema conhecido” (RF09).
- **RF08**: o TI transforma a solução de um chamado em novo passo de triagem com um clique.
- **Estoque**: cadastro com ID fixo, ciclo de vida validado (§4), descarte com aprovação do gestor (RN05),
  mínimo por tipo, sugestão de compra pelo consumo, garantia vencendo, defeitos recorrentes por modelo, folha
  de etiquetas para impressão, novo tipo de item (RF22–28, RF40).
- **Relatórios** calculados a partir dos dados (não fixos), com período 7/30/90 dias e exportação CSV/PDF (§3.7).
- **Catálogo editável** (passos, ordem, flags de operador parado e dano) e **importação por planilha** (RF43–47).
- **Personalização**: módulos opcionais (RF41) e roteamento de notificações por evento/grupo/canal (§3.6).
- **Auditoria** imutável de todas as ações sensíveis (RN08).

## Sugestões novas (além do escopo)

1. **Busca global (Ctrl+K ou “/”)** por número do chamado, etiqueta, ID interno, baia ou ocupante — atende o
   supervisor que consulta um item pelo celular.
2. **Aviso de chamado duplicado**: ao clicar numa baia que já tem chamado aberto, o sistema mostra qual é antes
   de abrir outro.
3. **Central de notificações** no próprio sistema, espelhando o que foi enviado ao BenHub (útil enquanto a
   integração não está confirmada).
4. **Comentários no chamado** entre quem abriu e o TI, sem mudar o status.
5. **Links diretos** para chamado, item e baia (`?ch=`, `?item=`, `?baia=`), bons para colar nas mensagens do BenHub.
6. **Progresso da triagem** visível e aviso em tempo real quando os passos estão sendo marcados rápido demais.
7. **“Resolvidos na triagem” na tela do supervisor**, para mostrar o resultado do trabalho dele.
8. **Aviso de prioridade** antes de abrir o chamado, quando ele vai entrar como prioritário.

## Próximos passos sugeridos

- Fase 0 na BenApi e troca do modo demonstração pelas rotas reais (ver README).
- Confirmar o canal do BenHub (API, webhook, bot ou e-mail).
- Validar com RH/jurídico o texto do termo e o fluxo do dossiê antes da produção (CLT, art. 462, §1º).
- Mutirão de inventário: a folha de etiquetas por mesa já está pronta para a etiquetagem baia a baia.
- QR code na etiqueta apontando para `?item=BEN-0000`, para o técnico abrir o histórico pela câmera.

## Tailwind e refinamento visual

- **Tailwind CSS 3**, no mesmo padrão do BenHeimdall (tokens em trincas RGB, componentes com `@apply`).
- **Fonte única, Inter**, neutra, para texto e títulos (sem a fonte de identidade do BenHeimdall).
- **Menos poluição:** sem códigos do escopo (RF/RN) na tela, descrições de página em uma linha, indicadores
  só com o número (a explicação fica no balão do mouse) e avisos agrupados num cartão “Precisa de atenção”.
- **Cartão de chamado em uma linha:** título, número, tempo desde a abertura, baia e ocupante; status à direita;
  faixa vermelha nos prioritários; alertas como ícones.
- **Detalhe do chamado em abas** (Resumo, Triagem, Comentários, Histórico) com as ações fixas no rodapé.
- **Menu do usuário no avatar:** situação do técnico, tema escuro, reiniciar demonstração e sair.
- **Menu lateral recolhível** (só ícones), lembrado entre as visitas.
- **Filtros do painel numa linha** e indicadores que funcionam como atalho de filtro (mostram quando estão ativos).

## Notificações “para você”

- **Aviso ao entrar** com os chamados direcionados à pessoa que ela ainda não viu: encaminhados a ela, novos na fila
  do departamento dela (TI ou RH) ou que voltaram para ela (reaberto/devolvido). Abrir o chamado conta como visto.
- **Sino** com a seção “Para você”, **contador no título da aba** (“(2) BenCalls”), marca **Novo** nos cartões e o
  KPI/filtro “Para você” no painel.
- **Na hora:** quando chega algo novo com o site aberto (mesmo vindo de outra aba), aparece um aviso com o botão
  **Abrir**; com **Avisos do navegador** ligado no menu do avatar, a notificação aparece até com o site em segundo plano.
- O TI pode **encaminhar** o chamado para um técnico específico, que é avisado ao entrar.

## WhatsApp das Baias (BenHermes)

- O controle dos WhatsApps das baias, que vivia só no BenHermes, agora aparece **na própria baia** e numa tela
  própria, com as **mesmas regras** (copiadas por script, com os testes do BenHermes rodando aqui).
- Manutenção diária com o texto do grupo, celulares, histórico, alertas no menu e o mesmo `.json` nos dois sistemas.
- Chamados e WhatsApp conversam: chamado “WhatsApp banido” marca o número, número perdido abre chamado de troca de
  chip, trocar o ocupante atualiza o operador e a supervisão é avisada quando um número cai.
- Detalhes e o caminho para a ligação direta pela API do BenHermes: [`BENHERMES.md`](BENHERMES.md).

