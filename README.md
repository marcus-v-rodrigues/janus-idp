# Janus IdP

Janus IdP é um Identity Provider (IdP) construído com **Node.js**, **Express**, **oidc-provider** e **Drizzle ORM**. Esta versão foi projetada para rodar inteiramente via **Docker Compose**.

## 🚀 Funcionalidades

- **Docker Ready**: Infraestrutura completa (App + Banco) com um único comando.
- **OpenID Connect Core**: Suporte a fluxos de `authorization_code` e `refresh_token`.
- **Persistência em PostgreSQL**: Armazenamento seguro de payloads OIDC e configurações de clientes.
- **Configuração Dinâmica**: Clientes OAuth carregados do banco de dados na inicialização.
- **Drizzle ORM**: ORM TypeScript moderno e leve para PostgreSQL.

## 🛠️ Pré-requisitos

- **Docker** e **Docker Compose** instalados.

## 📦 Como Instalar e Rodar

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/marcus-v-rodrigues/janus-idp.git
   cd janus-idp
   ```

2. **Configure as variáveis de ambiente:**
   Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
   *Certifique-se de que as variáveis `POSTGRES_USER`, `POSTGRES_PASSWORD` e `POSTGRES_DB` no `.env` correspondam ao que o App usará para conectar.*

3. **Suba o ambiente completo:**
   ```bash
   docker compose up -d --build
   ```
   Este comando irá:
   - Iniciar o banco de dados PostgreSQL.
   - Construir a imagem da aplicação.
   - Realizar o build do código.
   - Iniciar o servidor na porta configurada (padrão: 3000).

## 🗄️ Gerenciando o Banco de Dados (Via Docker)

Como a aplicação roda dentro do container, você pode executar comandos de manutenção usando `docker exec`:

### Gerar Migrations
```bash
docker compose exec app npm run db:generate
```

### Aplicar Migrations (Push)
```bash
docker compose exec app npm run db:push
```

### Popular Banco (Seed)
```bash
docker compose exec app npm run db:seed
```

### Drizzle Studio
```bash
docker compose exec app npm run db:studio
```

## 🧪 Como Testar

Após iniciar os containers, o servidor estará disponível em `http://localhost:3000`.

**Configurações para o OIDC Debugger:**
1. **Authorize URI**: `http://localhost:3000/oidc/auth`
2. **Token URI**: `http://localhost:3000/oidc/token`
3. **Client ID**: `test-client` (após rodar o seed)
4. **Scope**: `openid profile email`
5. **Redirect URI**: `https://oidcdebugger.com/debug`

Acesse a configuração do OpenID:
`http://localhost:3000/oidc/.well-known/openid-configuration`

## 🛠️ Desenvolvimento Local (Sem Docker para o App)

Se preferir rodar apenas o Banco de Dados via Docker e o código localmente:
1. Suba apenas o banco: `docker compose up -d db`
2. Instale dependências: `npm install`
3. Execute: `npm run dev`

## 📄 Licença

Este projeto está sob a licença ISC.
