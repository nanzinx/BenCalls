# Subindo o BenCalls no servidor (Docker + pm2 + Cloudflare Tunnel)

Mesmo modelo do BenURA e do BenHeimdall: o site roda num container endurecido, com pm2 dentro,
e chega à internet **só pelo Cloudflare Tunnel**, sem nenhuma porta aberta no servidor.

```
Usuário ──HTTPS──▶ Cloudflare (WAF, Access, cache) ──túnel (só saída)──▶ cloudflared ──▶ bencalls:8080 (pm2 × 2)
```

## 1. Pré-requisitos no servidor

- Linux com Docker 24+ e o plugin `docker compose`.
- Firewall fechado para entrada (o túnel só faz conexões de saída):

```bash
sudo ufw default deny incoming && sudo ufw default allow outgoing && sudo ufw allow OpenSSH && sudo ufw enable
```

## 2. Criar o túnel na Cloudflare

1. Painel da Cloudflare → **Zero Trust → Networks → Tunnels → Create a tunnel** → tipo **Cloudflared** → nome `bencalls`.
2. Em **Install and run a connector**, copie só o **token** (o texto longo depois de `--token`).
3. Em **Public Hostname**, adicione:
   - Subdomínio `chamados`, domínio `benconsig.com`
   - Service: **HTTP** → `localhost:8080`
   (o cloudflared roda na rede do container do BenCalls, por isso é `localhost`.)

## 3. Configurar e subir

```bash
git clone https://github.com/nanzinx/BenCalls.git && cd BenCalls
```

```bash
cp .env.example .env && nano .env    # cole o TUNNEL_TOKEN
```

```bash
./deploy/deploy.sh
```

O `deploy.sh` faz `git pull`, guarda a imagem atual para rollback, constrói (rodando typecheck e testes
dentro do Docker), sobe site + túnel, espera o healthcheck e, se a versão nova não ficar saudável,
volta sozinho para a anterior. Para atualizar depois, é só rodar o mesmo comando.

Atrás de um proxy corporativo com inspeção de TLS, passe o certificado no build:
`docker compose build` não aceita isso direto, então use
`docker build --secret id=ca_extra,src=/caminho/ca.crt -t bencalls:local .` e depois `./deploy/deploy.sh --sem-git`.

## 4. Proteções recomendadas na Cloudflare

| Onde | O quê |
|---|---|
| **Zero Trust → Access → Applications** | Aplicação *self-hosted* para `chamados.benconsig.com` com política **Allow** só para e-mails `@benconsig.com` (código por e-mail ou Google Workspace). Enquanto o front estiver em modo demonstração, isso impede acesso de fora. |
| SSL/TLS → Overview | **Full (strict)** |
| SSL/TLS → Edge Certificates | **Always Use HTTPS**, **Minimum TLS 1.2**, **HSTS** ligado |
| Security → WAF | **Managed rules** ligadas; regra de *rate limiting* (ex.: 100 req/10 s por IP) |
| Security → Bots | **Bot Fight Mode** |
| Caching → Cache Rules | `/assets/*` respeitando o cabeçalho da origem (já vem `immutable` por 1 ano) |

### Integração com o BenHermes atrás do Cloudflare Access

O BenHermes manda os eventos de servidor para servidor, então ele não passa pelo login do Access. Crie uma
segunda aplicação *self-hosted* só para o caminho `chamados.benconsig.com/api/integracoes/benhermes/eventos`
com a política **Bypass** (ou **Service Auth** com um *service token*, se quiser mais uma camada). A rota já
exige a assinatura HMAC e recusa o resto. Detalhes: [`API-INTEGRACAO.md`](API-INTEGRACAO.md).

## 5. Só IPs liberados

Como no BenHermes (`ALLOWED_IPS`), o BenCalls só atende os IPs e faixas de
[`server/ips-liberados.txt`](../server/ips-liberados.txt) (IPv4 e IPv6, com ou sem `/prefixo`); todo o resto recebe
**403**. Atrás do túnel o servidor usa o IP real do usuário (`CF-Connecting-IP`). Vale também no `npm run dev` e no
`npm run preview`. O `127.0.0.1` e o `::1` ficam na lista para o healthcheck e para rodar no próprio PC.

- Para somar endereços sem editar o arquivo: `IPS_LIBERADOS=1.2.3.4,2001:db8::/32` no `.env`.
- Lista vazia não deixa ninguém entrar (o log da subida avisa).
- No Docker do seu PC, o navegador chega com o IP interno do Docker: use `IPS_LIBERADOS=172.16.0.0/12`.
  `RESTRINGIR_IPS=0` desliga a restrição de vez: só para teste, nunca no servidor.
- O servidor do **BenHermes** precisa estar na lista para mandar os eventos da integração
  ([`API-INTEGRACAO.md`](API-INTEGRACAO.md)).

Depois de mudar a lista: `./deploy/deploy.sh`.

**Recomendado: barrar também na borda da Cloudflare**, para o acesso de fora nem chegar ao servidor.
Security → WAF → Custom rules → Create rule → *Edit expression*, ação **Block**:

```
(http.host eq "chamados.benconsig.com" and not ip.src in {201.93.163.133 201.93.159.169 2804:431:80f7::/48 2804:1b3:a5e7::/48})
```

(Na Cloudflare a faixa vai com o endereço de rede: `2804:431:80f7:7700::/48` é o mesmo bloco que
`2804:431:80f7::/48`, e os três `2804:1b3:a5e7:…/48` são o mesmo `2804:1b3:a5e7::/48`. Se o BenHermes estiver em
outro endereço, inclua o IP dele na regra.)

## 6. O que o endurecimento cobre

**Imagem (Dockerfile)**
- Três etapas: o build com devDependencies, testes e typecheck não vai para a imagem final.
- A imagem final tem só o `dist/`, o servidor (sem dependências) e o pm2 com versão travada (`server/package-lock.json`).
- npm, npx, yarn e corepack são removidos da imagem final.
- Correções de segurança do Debian aplicadas no build (`ATUALIZAR_SO=1`, padrão).
- Código do root e só leitura; tudo roda como `node` (uid 1000); `HEALTHCHECK` no `/healthz`.

**Container (docker-compose.yml)**
- `read_only`, `cap_drop: ALL`, `no-new-privileges`; escrita só em tmpfs (`/run/bencalls`, `/tmp`).
- Limites de memória (512 MB), CPU (1), processos (256), arquivos abertos e log (5 × 10 MB).
- Porta publicada só em `127.0.0.1`; o cloudflared também roda endurecido, com usuário sem privilégio.

**Servidor (server/servidor.mjs)**
- CSP fechado (`script-src 'self'`, `frame-ancestors 'none'`, sem CDN externo: as fontes são servidas pelo próprio site), HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP.
- Só serve os arquivos do build, carregados na memória na subida: não existe caminho para `../`.
- Só GET/HEAD, URL máxima de 2 KB, limite de requisições por IP (usa o `CF-Connecting-IP`), tempos curtos contra conexões lentas.
- Cache imutável para `/assets/*` (nome com hash), `no-cache` para o `index.html`, compressão brotli/gzip e ETag.

**pm2 (ecosystem.config.cjs)**
- Modo cluster (2 cópias por padrão, `PM2_INSTANCIAS`), `wait_ready`, reinício com espera crescente, limite de memória por processo e desligamento gracioso.

## 7. Sem Docker (pm2 direto no servidor)

```bash
npm ci && npm run verificar
```

```bash
npx pm2 start ecosystem.config.cjs && npx pm2 save && npx pm2 startup
```

E o túnel como serviço, usando `cloudflared/config.example.yml` (instruções no próprio arquivo).

## 8. Operação

```bash
docker compose ps
```

```bash
docker compose logs -f bencalls
```

```bash
docker compose exec bencalls node node_modules/pm2/bin/pm2 list
```

```bash
curl -s http://127.0.0.1:8080/healthz
```
