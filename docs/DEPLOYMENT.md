# Guia de Implantação e Produção

O Janus-IDP foi projetado para ser executado em containers, facilitando a orquestração via **Docker Compose** ou **Kubernetes**.

---

## 🏗️ Estratégia de Deploy (Docker)

A forma recomendada de subir o Janus é utilizando o arquivo `docker-compose.yml` fornecido.

### 1. Preparação do Ambiente
Crie a rede externa se necessário:
```bash
docker network create ux-auditor-network
```

### 2. Configuração do `.env`
Certifique-se de definir segredos fortes em produção:
- `JANUS_SERVICE_API_KEY`: Chave para APIs programáticas.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: Credenciais do portal admin.
- `COOKIE_SECRET`: Segredo para assinatura de cookies da sessão Express.
- `OIDC_COOKIES_KEYS`: Lista de chaves separadas por vírgula para o oidc-provider.

---

## 🔒 Considerações de Segurança em Produção

### HTTPS e Reverse Proxy
O Janus-IDP **NÃO** deve ser exposto diretamente na porta 80. Utilize um Reverse Proxy (Nginx, Traefik, Caddy) para:
- Termináção SSL (HTTPS).
- Compressão Gzip/Brotli.
- Proteção contra ataques DDoS básicos.

**Headers Recomendados:**
Certifique-se de que o proxy repasse os headers:
- `X-Forwarded-For`
- `X-Forwarded-Proto` (essencial para que o OIDC emita URLs HTTPS)
- `X-Forwarded-Host`

### Variável `NODE_ENV`
Sempre utilize `NODE_ENV=production`. Isso habilita:
- Cookies com flag `Secure`.
- Logs otimizados.
- Desativação de stack traces em erros na UI.

---

## 💾 Persistência de Dados

### Banco de Dados (PostgreSQL)
Em produção, recomenda-se utilizar um banco de dados gerenciado (RDS, Cloud SQL, etc.) em vez de um container PostgreSQL local, para garantir:
- Backup automático.
- Alta disponibilidade.
- Escalabilidade vertical facilitada.

### Chaves RSA
Persista as chaves RSA geradas no volume `rsa_keys` ou injete-as via `RSA_PRIVATE_KEY` e `RSA_PUBLIC_KEY`. Sem chaves persistentes, todos os tokens emitidos serão invalidados se o container reiniciar.

---

## 📈 Monitoramento e Logs

### Logs
O Janus utiliza logs estruturados em texto plano (padrão Express). Em ambientes de container, direcione o `stdout` para seu agregador de logs (CloudWatch, ELK, Loki).

### Healthcheck
Configure o seu orquestrador para monitorar o endpoint `/health`. O Janus responderá `200 OK` apenas se a conexão com o banco de dados estiver ativa.

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```
