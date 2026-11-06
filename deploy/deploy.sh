#!/usr/bin/env bash
# Atualiza o BenCalls no servidor com rollback automático.
#
#   ./deploy/deploy.sh              atualiza do git (branch atual), reconstrói e sobe com o túnel
#   ./deploy/deploy.sh --sem-git    só reconstrói e sobe (código já está no lugar)
#   ./deploy/deploy.sh --sem-tunel  sobe sem o Cloudflare Tunnel
#
# Passos: git pull → guarda a imagem atual como bencalls:anterior → build (com typecheck e
# testes dentro do Docker) → sobe → espera o healthcheck → se não ficar saudável, volta a
# imagem anterior e sai com erro.
set -euo pipefail
cd "$(dirname "$0")/.."

GIT=1
PERFIL=(--profile tunel)
for a in "$@"; do
  case "$a" in
    --sem-git) GIT=0 ;;
    --sem-tunel) PERFIL=() ;;
    *) echo "Opção desconhecida: $a" >&2; exit 2 ;;
  esac
done

log() { printf '\033[1;34m[bencalls]\033[0m %s\n' "$*"; }
falha() { printf '\033[1;31m[bencalls]\033[0m %s\n' "$*" >&2; }

[ -f .env ] || { falha "Falta o .env (copie de .env.example)."; exit 1; }
if [ ${#PERFIL[@]} -gt 0 ] && ! grep -Eq '^TUNNEL_TOKEN=.+' .env; then
  falha "TUNNEL_TOKEN vazio no .env. Use --sem-tunel ou preencha o token (docs/DEPLOY.md)."
  exit 1
fi

if [ "$GIT" = 1 ]; then
  log "Atualizando o código (git pull --ff-only)…"
  git pull --ff-only
fi
VERSAO="$(git rev-parse --short HEAD 2>/dev/null || echo dev)"
export BENCALLS_VERSAO="$VERSAO"

if docker image inspect bencalls:local >/dev/null 2>&1; then
  log "Guardando a imagem atual como bencalls:anterior (para rollback)."
  docker tag bencalls:local bencalls:anterior
fi

log "Construindo a versão $VERSAO (typecheck + testes + build dentro do Docker)…"
# Segredo da integração com o BenHermes: arquivo vazio = integração desligada (o compose exige o arquivo).
if [ ! -f deploy/benhermes_segredo.txt ]; then
  install -m 644 /dev/null deploy/benhermes_segredo.txt
  echo "Integração BenHermes desligada (deploy/benhermes_segredo.txt vazio). Veja docs/API-INTEGRACAO.md."
fi
docker compose build --pull bencalls

log "Subindo…"
docker compose "${PERFIL[@]}" up -d

log "Esperando o healthcheck…"
for _ in $(seq 1 30); do
  ESTADO="$(docker inspect --format '{{.State.Health.Status}}' bencalls 2>/dev/null || echo desconhecido)"
  [ "$ESTADO" = "healthy" ] && break
  sleep 2
done

if [ "${ESTADO:-}" != "healthy" ]; then
  falha "A versão $VERSAO não ficou saudável (estado: ${ESTADO:-?})."
  docker compose logs --tail 50 bencalls || true
  if docker image inspect bencalls:anterior >/dev/null 2>&1; then
    falha "Voltando para a versão anterior…"
    docker tag bencalls:anterior bencalls:local
    docker compose "${PERFIL[@]}" up -d --no-build
  fi
  exit 1
fi

log "No ar: versão $VERSAO"
curl -fsS "http://127.0.0.1:${BENCALLS_PORTA:-8080}/healthz" && echo
docker image prune -f >/dev/null 2>&1 || true
