# Configuração de Ambiente

Este documento descreve todas as variáveis de ambiente disponíveis para configurar o Janus IdP.

## Arquivo de Configuração

As variáveis de ambiente devem ser definidas no arquivo `.env`. Use o arquivo [`.env.example`](/.env.example) como referência:

```bash
cp .env.example .env
```

## Variáveis de Ambiente

### Aplicação

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `APP_PORT` | `3000` | Porta onde o servidor HTTP será executado |
| `NODE_ENV` | `development` | Ambiente (`development` ou `production`) |

### Banco de Dados

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `POSTGRES_HOST` | `janus-db` | Host do PostgreSQL (use `localhost` em dev local) |
| `POSTGRES_PORT` | `5432` | Porta do PostgreSQL |
| `POSTGRES_USER` | `janus_admin` | Usuário do PostgreSQL |
| `POSTGRES_PASSWORD` | `123_senha_segura` | Senha do PostgreSQL |
| `POSTGRES_DB` | `janus-db` | Nome do banco de dados |
| `DATABASE_URL` | Gerado automaticamente | URL de conexão completa com PostgreSQL |

**Nota**: Para desenvolvimento local onde o banco roda no host (não no container), configure:

```bash
POSTGRES_HOST=localhost
DATABASE_URL="postgresql://janus_admin:123_senha_segura@localhost:5432/janus-db?schema=public"
```

### OIDC

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `ISSUER_URL` | `http://localhost:3000/oidc` | URL base do provedor OpenID Connect |
| `COOKIE_KEYS` | Duas chaves padrão | Lista de chaves separadas por vírgulas para assinatura de cookies (OIDC) |

### Usuário Administrador

Estas variáveis são usadas pelo script de seed ([`drizzle/seed.ts`](drizzle/seed.ts:1)) para criar o usuário administrador inicial.

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `ADMIN_EMAIL` | `admin@seudominio.com` | Email do usuário administrador |
| `ADMIN_PASSWORD` | `Admin123!` | Senha do usuário administrador |
| `ADMIN_NAME` | `Administrador` | Nome do usuário administrador |

**Segurança**: Em produção, **altere imediatamente** a senha do administrador após o primeiro login.

### Clientes OIDC (Seed)

Estas variáveis são usadas pelo script de seed para criar clientes OIDC iniciais.

#### Cliente de Teste (OIDC Debugger)

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `OIDC_CLIENT_ID` | `test-client` | Client ID do cliente de teste |
| `OIDC_CLIENT_SECRET` | `test-secret` | Client secret do cliente de teste |
| `OIDC_REDIRECT_URIS` | `https://oidcdebugger.com/debug` | URIs de redirecionamento (vírgula múltipla) |

#### Cliente UX Auditor

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `UX_CLIENT_ID` | `ux-auditor` | Client ID do cliente UX Auditor |
| `UX_CLIENT_SECRET` | `your_client_secret_here_change_in_production` | Client secret do cliente UX Auditor |
| `UX_BASE_DOMAIN` | `http://localhost:3001` | Domínio base do serviço UX Auditor |

**Nota**: As URIs de redirecionamento são construídas automaticamente como:
```
${UX_BASE_DOMAIN}/api/auth/callback/janus
```

### Chaves RSA

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `RSA_PRIVATE_KEY` | Não definido | Chave privada RSA codificada em Base64 (opcional) |
| `RSA_PUBLIC_KEY` | Não definido | Chave pública RSA codificada em Base64 (opcional) |

**Geração automática**: Se estas variáveis não forem definidas, o sistema gerará automaticamente um novo par de chaves RSA-2048.

**Para produção**: É recomendado gerar chaves próprias e configurá-las via variáveis de ambiente. Veja [Configuração de Chaves RSA](KEYS_SETUP.md) para mais detalhes.

**Codificando chaves em Base64**:
```bash
cat keys/private.pem | base64 -w 0  # Para RSA_PRIVATE_KEY
cat keys/public.pem | base64 -w 0   # Para RSA_PUBLIC_KEY
```

### Sessão

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `SESSION_SECRET` | `janus-session-secret-change-in-production` | Segredo para assinar sessões do Express |

**Segurança**: Em produção, use uma string aleatória longa e secreta.

### API Key

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `JANUS_SERVICE_API_KEY` | `your_service_api_key_here_change_in_production` | Chave de API para autenticar serviços externos |

**Uso**: Esta chave deve ser enviada no header `X-Service-Key` em todas as requisições para `/api/*`.

## Exemplo de .env Completo

```bash
# ================================================================================
# Janus IdP - Configuração de Ambiente
# ================================================================================

# Aplicação
APP_PORT=3000
NODE_ENV=development

# Banco de Dados PostgreSQL
POSTGRES_USER=janus_admin
POSTGRES_PASSWORD=senha_segura_muito_forte_123!
POSTGRES_DB=janus-db
POSTGRES_PORT=5432
POSTGRES_HOST=janus-db

# URL de conexão (Docker)
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public"

# OIDC Configuration
ISSUER_URL=http://localhost:3000/oidc

# Cookie Keys (lista separada por vírgulas)
COOKIE_KEYS=chave_secreta_1_aleatoria_very_long,outra_chave_secreta_2

# ================================================================================
# Usuário Administrador (Seed)
# ================================================================================
ADMIN_EMAIL=admin@seudominio.com
ADMIN_PASSWORD=SenhaAdminMuitoSegura123!
ADMIN_NAME=Administrador

# ================================================================================
# Clientes OIDC (Seed)
# ================================================================================

# Cliente de Teste (OIDC Debugger)
OIDC_CLIENT_ID=test-client
OIDC_CLIENT_SECRET=test-secret
OIDC_REDIRECT_URIS=https://oidcdebugger.com/debug

# Cliente UX Auditor
UX_CLIENT_ID=ux-auditor
UX_CLIENT_SECRET=uxDashboard_secret_muito_secreto_123!
UX_BASE_DOMAIN=http://localhost:3001

# ================================================================================
# Chaves RSA (Opcional - geradas automaticamente se não definidas)
# ================================================================================
# Para produção, gere chaves e codifique em Base64:
# npm run generate-keys
# RSA_PRIVATE_KEY="..."
# RSA_PUBLIC_KEY="..."

# ================================================================================
# Segurança
# ================================================================================
SESSION_SECRET=uma_string_aleatoria_muito_longa_para_session_secret
JANUS_SERVICE_API_KEY=uma_chave_de_api_aleatoria_muito_segura_12345
```

## Validações

O sistema realiza as seguintes validações:

1. **DATABASE_URL**: Se inválido, o servidor falhará ao iniciar
2. **POSTGRES_HOST**: Deve ser acessível do servidor
3. **COOKIE_KEYS**: Pelo menos uma chave deve ser fornecida
4. **Emails**: Validados via regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
5. **Senhas**: Mínimo 6 caracteres (algumas validações podem exigir mais)

## Variáveis Novas no Runtime

Além das variáveis definidas no `.env`, o sistema usa:

| Variável | Fonte | Descrição |
|----------|-------|-----------|
| `PORT` | Sistema ou APP_PORT | Porta onde o servidor está rodando |

## Segurança em Produção

### Checklist antes de ir para produção:

- [ ] Altere `POSTGRES_PASSWORD` para uma senha forte
- [ ] Altere `ADMIN_PASSWORD` para uma senha forte
- [ ] Altere `SESSION_SECRET` para uma string aleatória longa
- [ ] Altere `COOKIE_KEYS` para strings aleatórias longas
- [ ] Altere `JANUS_SERVICE_API_KEY` para uma chave forte
- [ ] Gere e configure chaves RSA (`RSA_PRIVATE_KEY`, `RSA_PUBLIC_KEY`)
- [ ] Altere os segredos dos clientes (`UX_CLIENT_SECRET`)
- [ ] Não faça commit do arquivo `.env` (já está no `.gitignore`)
- [ ] Use `NODE_ENV=production`
- [ ] Configure `ISSUER_URL` com o domínio correto (HTTPS em produção)
- [ ] Use HTTPS em produção
- [ ] Configure firewalls apropriados

### Gerando strings aleatórias:

```bash
# Para SESSION_SECRET, COOKIE_KEYS, JANUS_SERVICE_API_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Para POSTGRES_PASSWORD
openssl rand -base64 32

# Para ADMIN_PASSWORD
# Use um gerador de senhas forte do seu sistema
```

## Debug

Se tiver problemas, verifique:

1. O arquivo `.env` existe e está no diretório raiz
2. As variáveis estão corretamente escritas (sem espaços extras)
3. As aspas são consistentes (aspas duplas para DATABASE_URL)
4. Sinais de comentário (`#`) estão apenas no início das linhas
5. Não há caracteres invisíveis (use `cat -A .env` para verificar)
