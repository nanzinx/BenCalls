# syntax=docker/dockerfile:1.7
# BenCalls (front) em container: build do Vite + servidor Node próprio no pm2-runtime.
# Mesmo modelo do BenURA/BenHeimdall. README: "Deploy" e docs/DEPLOY.md.
#
# Endurecido (o docker-compose completa com read_only, cap_drop ALL e no-new-privileges):
#  - três etapas: o build (com devDependencies, testes e typecheck) não vai para a imagem final;
#  - a imagem final tem só o dist/, o servidor (sem dependências) e o pm2 (versão travada no lock);
#  - npm, npx e yarn são removidos da imagem final (menos ferramentas para um invasor);
#  - o código é do root e só leitura; tudo roda como o usuário "node" (uid 1000);
#  - pacotes do sistema atualizados na construção; HEALTHCHECK no /healthz.

ARG NODE_IMAGE=node:22-bookworm-slim

# --- 1. Build: instala, confere (tipos e testes) e gera o dist/ ---
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Atrás de proxy com inspeção TLS: --secret id=ca_extra,src=ca.crt (não fica em nenhuma camada).
RUN --mount=type=secret,id=ca_extra,required=false \
    if [ -f /run/secrets/ca_extra ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca_extra; fi; \
    npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run typecheck && npm test && npm run build

# --- 2. Dependências de execução: só o pm2 (lock próprio em server/) ---
FROM ${NODE_IMAGE} AS deps
WORKDIR /deps
COPY server/package.json server/package-lock.json ./
RUN --mount=type=secret,id=ca_extra,required=false \
    if [ -f /run/secrets/ca_extra ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca_extra; fi; \
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

# --- 3. Imagem final ---
FROM ${NODE_IMAGE}
ARG VERSAO=dev
LABEL org.opencontainers.image.title="BenCalls" \
      org.opencontainers.image.description="Sistema de Chamados da Benconsig (front)" \
      org.opencontainers.image.vendor="Benconsig" \
      org.opencontainers.image.version="${VERSAO}"

# ATUALIZAR_SO=1 (padrão) aplica as correções de segurança do Debian na construção.
ARG ATUALIZAR_SO=1
RUN if [ "$ATUALIZAR_SO" = "1" ]; then \
      apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/*; \
    fi \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg

ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    PORT=8080 \
    HOST=0.0.0.0 \
    DIST_DIR=/app/dist \
    BENCALLS_VERSAO=${VERSAO} \
    # Com o disco só leitura, o pm2 escreve só no tmpfs.
    PM2_HOME=/run/bencalls/pm2 \
    NODE_OPTIONS="--max-http-header-size=16384"

WORKDIR /app
COPY --from=deps /deps/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server/servidor.mjs server/bloqueio.mjs server/ips-bloqueados.txt ./server/
COPY ecosystem.config.cjs ./
RUN chmod -R a-w /app \
 && mkdir -p /run/bencalls \
 && chown node:node /run/bencalls
USER node

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# pm2-runtime fica em primeiro plano e repassa o desligamento gracioso aos processos.
CMD ["node", "node_modules/pm2/bin/pm2-runtime", "ecosystem.config.cjs"]
