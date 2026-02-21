# Deploy em Produção

Este documento fornece instruções detalhadas para realizar o deploy do Janus IdP em ambiente de produção.

## Pré-Requisitos

- Docker e Docker Compose instalados
- Acesso ao servidor de produção
- Domínio configurado (ex: `idp.seudominio.com`)
- Certificado SSL configurado (recomendado: Let's Encrypt)

## Checklist de Preparação

### 1. Segurança

Antes de colocar em produção, revise sua configuração:

```bash
# Configure senhas fortes
POSTGRES_PASSWORD=<senha_forte>
SESSION_SECRET=<string_aleatoria_longa>
COOKIE_KEYS=<string_aleatoria_1>,<string_aleatoria_2>
JANUS_SERVICE_API_KEY=<chave_api_forte>
ADMIN_PASSWORD=<senha_admin_forte>
UX_CLIENT_SECRET=<segredo_cliente_forte>
```

### 2. Chaves RSA

Gere chaves RSA para assinatura de tokens:

```bash
npm run generate-keys

# O script exibirá as chaves em Base64 para copiar para o .env
# Ou codifique manualmente:
cat keys/private.pem | base64 -w 0
cat keys/public.pem | base64 -w 0
```

Adicione ao `.env`:

```bash
RSA_PRIVATE_KEY="<chave_privada_base64>"
RSA_PUBLIC_KEY="<chave_publica_base64>"
```

### 3. Variáveis de Ambiente

Configure as variáveis críticas para produção:

```bash
NODE_ENV=production
APP_PORT=3000
ISSUER_URL=https://idp.seudominio.com/oidc

POSTGRES_HOST=janus-db
DATABASE_URL="postgresql://postgres_user:strong_pass@janus-db:5432/janus-db?schema=public"
```

### 4. Rede Docker

Se o sistema faz parte do ecossistema UX Auditor, crie a rede:

```bash
docker network create ux-auditor-network
```

## Deploy com Docker Compose

### 1. Subir os Serviços

```bash
# Clone o repositório
git clone https://github.com/marcus-v-rodrigues/janus-idp.git
cd janus-idp

# Configure o .env
cp .env.example .env
nano .env  # Edite as configurações

# Crie a rede (se necessário)
docker network create ux-auditor-network

# Suba os containers
docker compose up -d --build
```

### 2. Verificar Status

```bash
# Verificar status dos containers
docker compose ps

# Verificar logs
docker compose logs -f janus-service

# Verificar healthcheck
curl http://localhost:3000/health
```

## Deploy com Reverse Proxy (Nginx)

Em produção, é recomendado usar um reverse proxy como Nginx com SSL.

### Configuração de Exemplo (Nginx)

```nginx
# /etc/nginx/sites-available/idp.seudominio.com

server {
    listen 80;
    server_name idp.seudominio.com;

    # Redirecionar para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name idp.seudominio.com;

    # Certificado SSL
    ssl_certificate /etc/letsencrypt/live/idp.seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/idp.seudominio.com/privkey.pem;

    # Configurações SSL recomendadas
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Headers de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy para o Janus IdP
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Habilitar o site:

```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/idp.seudominio.com /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx

# Obter certificado SSL (Let's Encrypt)
sudo certbot --nginx -d idp.seudominio.com
```

## Deploy com Docker Swarm

Para maior disponibilidade, use Docker Swarm:

### 1. Inicializar Swarm

```bash
docker swarm init
```

### 2. Deploy como Stack

```bash
docker stack deploy -c docker-compose.swarm.yml janus-idp
```

Exemplo de `docker-compose.swarm.yml`:

```yaml
version: '3.8'

services:
  janus-db:
    image: postgres:15-alpine
    deploy:
      replicas: 1
      update_config:
        parallelism: 1
        delay: 10s
        restart_policy:
          condition: on-failure
    environment:
      POSTGRES_DB: janus-db
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    networks:
      - ux-auditor-network
    volumes:
      - janus-postgres-data:/var/lib/postgresql/data

  janus-service:
    image: janus-idp:latest
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
    environment:
      NODE_ENV: production
      ISSUER_URL: https://idp.seudominio.com/oidc
      DATABASE_URL: ${DATABASE_URL}
    networks:
      - ux-auditor-network
    ports:
      - "3000:3000"

networks:
  ux-auditor-network:
    external: true

volumes:
  janus-postgres-data:
```

## Backup e Restore

### Backup do Banco de Dados

```bash
# Backup
docker compose exec janus-db pg_dump -U janus_admin janus-db > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup compactado
docker compose exec janus-db pg_dump -U janus_admin janus-db | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restore do Banco de Dados

```bash
# Restore de arquivo
docker compose exec -T janus-db psql -U janus_admin janus-db < backup_20260221_120000.sql

# Restore de arquivo compactado
gunzip < backup_20260221_120000.sql.gz | docker compose exec -T janus-db psql -U janus_admin janus-db
```

### Backup das Chaves RSA

```bash
# Copiar volume de chaves
docker run --rm -v janus-rsa-keys:/data -v $(pwd):/backup alpine tar czf /backup/rsa-keys-backup.tar.gz -C /data .
```

### Backup da Configuração

```bash
# Backup completo
tar czf janus-idp-backup-$(date +%Y%m%d_%H%M%S).tar.gz \
  .env \
  docker-compose.yml \
  Dockerfile \
  drizzle/
```

## Monitoring

### Logs

```bash
# Ver logs em tempo real
docker compose logs -f janus-service

# Ver últimos 100 linhas
docker compose logs --tail=100 janus-service
```

### Health Check

O servidor expõe um endpoint de healthcheck:

```bash
curl https://idp.seudominio.com/health
```

Resposta esperada:

```json
{
  "status": "ok"
}
```

### Metrics

Para monitoramento avançado, considere:

- **Prometheus**: Exponha métricas personalizadas
- **Grafana**: Crie dashboards de monitoramento
- **Elastic Stack**: Agregação de logs
- **Sentry**: Rastreamento de erros

## Escalabilidade

### PostgreSQL Scaling

Para maior performance do PostgreSQL:

1. **Adicionar réplica** usando streaming replication
2. **Connection pooling** com PgBouncer
3. **Read replicas** para consultas

### Application Scaling

Para escalar a aplicação:

1. **Horizontal scaling**: Aumente réplicas no Docker Swarm/Kubernetes
2. **Load balancer**: Use Nginx ou HAProxy
3. **Session storage**: Para múltiplas instâncias, considere Redis para sessões

## Segurança Avançada

### Firewall

```bash
# Apenas porta 80 e 443 acessíveis externamente
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3000/tcp
sudo ufw enable
```

### Rate Limiting

Configure rate limiting no Nginx:

```nginx
# Adicionar em http block
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

# Aplicar em location
location /api/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://localhost:3000;
}
```

### Fail2Ban

Proteção contra ataques de força bruta:

```bash
# Instalar
sudo apt install fail2ban

# Criar configuração
sudo nano /etc/fail2ban/jail.local
```

## Troubleshooting

### Container não inicia

```bash
# Ver logs
docker compose logs janus-service

# Ver status do container
docker compose ps janus-service

# Entrar no container para debug
docker compose exec janus-service sh
```

### Erro de conexão com banco

```bash
# Verificar se o banco está rodando
docker compose ps janus-db

# Testar conexão
docker compose exec janus-db psql -U janus_admin -d janus-db -c "SELECT 1"
```

### Chaves RSA perdidas

```bash
# Se as chaves foram geradas automaticamente e não foram salvas,
# os tokens emitidos anteriormente ficarão inválidos.
# Gere novas chaves e atualize o .env:
npm run generate-keys
```

### Healthcheck falhando

```bash
# Verificar se o servidor está respondendo
curl http://localhost:3000/health

# Ver logs do container
docker compose logs janus-service | tail -50
```

## Atualização e Manutenção

### Atualizar a Aplicação

```bash
# Pull das mudanças
git pull origin main

# Reconstruir e reiniciar
docker compose up -d --build janus-service

# Executar migrations se necessário
docker compose exec janus-service npm run db:push
```

### Atualizar o Banco de Dados

```bash
# Gerar migrations
docker compose exec janus-service npm run db:generate

# Aplicar migrations
docker compose exec janus-service npm run db:migrate
```

### Backup Antes de Atualizar

Como boa prática, sempre faça backup antes de atualizar:

```bash
# Backup database
docker compose exec janus-db pg_dump -U janus_admin janus-db > backup-pre-update.sql

# Backup configurações
tar czf config-backup.tar.gz .env docker-compose.yml
```

## Recursos Adicionais

- [Documentação do Docker Compose](https://docs.docker.com/compose/)
- [Documentação do Nginx](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Docker Swarm](https://docs.docker.com/engine/swarm/)
- [Kubernetes](https://kubernetes.io/)
