# BenCalls — Sistema de Chamados da Benconsig (front v2)

Front novo do sistema de chamados, construído a partir do **Documento de Escopo v2.0** e do protótipo navegável.
Chamado vinculado à baia, triagem guiada, estoque com etiqueta e histórico, termo de responsabilidade,
dossiê para o RH, notificações pelo BenHub e personalização por empresa (white label).

> **Modo demonstração.** Enquanto a fase 0 (segurança da BenApi) não sai, o front roda com dados fictícios
> gerados no navegador e salvos no `localStorage`. Cada ação do código indica a rota da BenApi que ela
> vai chamar (§11.3 e §13.3 do escopo), para a troca ser direta.

## Rodando

```bash
npm install
```

```bash
npm run dev
```

Abra `http://localhost:5173` e entre com um dos perfis de demonstração (Supervisora, Supervisor do Digital,
Técnico de TI, RH, Diretora). Para voltar ao estado inicial: menu lateral › **Reiniciar demonstração**.

```bash
npm test        # regras de negócio (etiquetas, SLA, triagem, estoque, contraste)
npm run build   # build de produção (Vercel: vercel.json já faz o rewrite da SPA)
```

## Stack

React 18 + Vite, React Router, Recharts e lucide-react — a mesma base do front atual (§9).
Sem framework de CSS: um design system próprio em `src/styles/global.css`, com variáveis que o tema da
instalação sobrescreve (RF36) e modo escuro.

## Estrutura

```
src/
  lib/          regras puras e testadas: labels (etiquetas/mesas), rules (SLA, triagem, estoque), contrast, csv
  data/seed.js  dados de demonstração determinísticos (69 posições reais, catálogo, estoque, 30 dias de histórico)
  store/        estado + ações (cada ação = uma rota da BenApi) e seletores
  components/   Layout, busca global, detalhe de chamado/item/baia, mapa da mesa, triagem, UI base
  pages/        uma tela por rota
tests/          node:test
docs/           MELHORIAS.md — o que foi aprimorado em relação ao protótipo e próximos passos
```

## Telas e perfis

| Tela | Rota | Quem vê (código de acesso) |
|---|---|---|
| Meus chamados | `/inicio` | DACP |
| Novo chamado (mapa + triagem, ou formulário) | `/novo` | RC |
| Painel de chamados (quadro e lista) | `/painel` | PC |
| Mapa geral | `/mapa` | MAPA |
| Revisão de “Outros” | `/revisao` | REV |
| Estoque e patrimônio | `/estoque` | EST |
| Termos de responsabilidade | `/termos` | TERMO (módulo) |
| Dossiês do RH | `/rh` | RH (módulo) |
| Dashboard e relatórios | `/relatorios` | DVGC |
| Usuários · Catálogo · Espaços · Personalização · Auditoria | `/usuarios` … | CU · RCSC · ESP · TEMA · AUD |

Detalhes abrem em painel lateral por parâmetro de URL, de qualquer tela: `?ch=171`, `?item=BEN-0412`, `?baia=OP1:E2`
(o link pode ser copiado e enviado no BenHub).

## Ligando na BenApi

1. Fase 0 (JWT, BCrypt, chave do BenTabularium em variável de ambiente) — pré-requisito, §12.
2. Definir `VITE_API_URL` (ver `.env.example`).
3. Trocar o corpo de cada ação em `src/store/store.jsx` pela chamada HTTP indicada no comentário dela.
   As regras que hoje rodam no navegador (triagem obrigatória, laudo, descarte com aprovação) passam a ser
   conferidas na API — o front continua validando só para dar retorno imediato.
