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

Abra `http://localhost:5173` e, em **Entrar com um perfil de demonstração**, escolha Supervisora, Supervisor
do Digital, Técnico de TI, RH ou Diretora. Depois do login aparece a entrada animada (uma vez por dia, como no
BenHeimdall). Para voltar ao estado inicial: menu lateral › **Reiniciar demonstração**.

```bash
npm run verificar   # typecheck (TypeScript) + testes (regras, entrada, servidor) + build
```

## Deploy (Docker + pm2 + Cloudflare Tunnel)

```bash
cp .env.example .env    # cole o TUNNEL_TOKEN
```

```bash
./deploy/deploy.sh      # build com testes, sobe site + túnel, healthcheck e rollback automático
```

Container endurecido (só leitura, sem root, sem capabilities, sem npm), servidor Node próprio com CSP e
cabeçalhos de segurança, pm2 em modo cluster e nenhuma porta aberta: o acesso chega pelo túnel.
Passo a passo completo, incluindo a configuração na Cloudflare: [docs/DEPLOY.md](docs/DEPLOY.md).

## Stack

React 18 + Vite + TypeScript + **Tailwind CSS 3**, React Router, Recharts e lucide-react — a mesma base do front
atual (§9) e o mesmo padrão de estilos do BenHeimdall.
As regras de negócio (`src/lib`), o logo, a entrada animada e as regras de sessão são TypeScript estrito
(`npm run typecheck`); as telas seguem em JSX e migram aos poucos.

**Estilos:** `tailwind.config.ts` define cores (trincas RGB com nomes em português: `marca`, `destaque`,
`superficie`, `tinta`, `mudo`, `ok`, `aviso`, `ruim`…), sombras e animações; `src/index.css` tem os tokens dos
temas claro/escuro em `@layer base` e os componentes (`.btn`, `.card`, `.kpi`, `.ticket`, `.seat`…) em
`@layer components` com `@apply`. O JSX usa essas classes e os utilitários do Tailwind. O tema de cada empresa
sobrescreve as variáveis, então `bg-marca/10` funciona com qualquer cor. Classes de componente montadas com
`${...}` precisam estar no `safelist` (há um teste que confere). Fonte única: **Inter**, servida pelo próprio site.

## Estrutura

```
src/
  lib/          regras puras em TypeScript e testadas: labels, rules (prioridade, triagem, estoque), contrast, entrada, csv
  data/seed.js  dados de demonstração determinísticos (69 posições reais, catálogo, estoque, 30 dias de histórico)
  store/        estado + ações (cada ação = uma rota da BenApi) e seletores
  components/   Layout, busca global, detalhe de chamado/item/baia, mapa da mesa, triagem, UI base
  pages/        uma tela por rota
  index.css     tokens e componentes (Tailwind)
server/        servidor de produção (Node puro) + lock do pm2 da imagem
deploy/        deploy.sh (atualização com rollback)
cloudflared/   exemplo de túnel por arquivo
tests/         node:test (regras, entrada, servidor)
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
